import auth from '../middlewares/auth.mjs';
import { badRequest, notFound, checkId, HttpError } from '../utils/http.mjs';
import { loadEvent } from '../utils/loaders.mjs';
import { isOrganizer } from '../utils/permissions.mjs';

const Polls = class Polls {
  constructor(app, models) {
    this.app = app;
    this.models = models;
    this.Poll = models.Poll;
    this.PollAnswer = models.PollAnswer;

    this.run();
  }

  async loadPoll(pollId, userId) {
    checkId(pollId, 'pollId');
    const poll = await this.Poll.findById(pollId);
    if (!poll) throw notFound('Poll');
    const event = await loadEvent(this.models, poll.event, userId, 'participant');
    return { poll, event };
  }

  static buildQuestions(questions) {
    if (!Array.isArray(questions)) throw badRequest('questions doit être un tableau');
    return questions.map((q) => {
      if (!q || !Array.isArray(q.options)) throw badRequest('Chaque question doit avoir un tableau options');
      return {
        label: q.label,
        options: q.options.map((opt) => ({ label: typeof opt === 'string' ? opt : opt?.label }))
      };
    });
  }

  create() {
    this.app.post('/events/:id/polls', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'organizer');
      const poll = await this.Poll.create({
        event: event._id,
        title: req.body.title,
        questions: Polls.buildQuestions(req.body.questions),
        created_by: req.user.id
      });
      res.status(201).json(poll);
    });
  }

  list() {
    this.app.get('/events/:id/polls', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'participant');
      const polls = await this.Poll.find({ event: event._id }).sort({ created_at: -1 });
      res.status(200).json(polls);
    });
  }

  getOne() {
    this.app.get('/polls/:id', auth, async (req, res) => {
      const { poll } = await this.loadPoll(req.params.id, req.user.id);
      const myAnswer = await this.PollAnswer.findOne({ poll: poll._id, user: req.user.id });
      res.status(200).json({ ...poll.toObject(), my_answer: myAnswer });
    });
  }

  remove() {
    this.app.delete('/polls/:id', auth, async (req, res) => {
      const { poll, event } = await this.loadPoll(req.params.id, req.user.id);
      if (!isOrganizer(event, req.user.id)) throw new HttpError(403, 'Réservé aux organisateurs');
      await this.PollAnswer.deleteMany({ poll: poll._id });
      await poll.deleteOne();
      res.status(204).send();
    });
  }

  answer() {
    this.app.post('/polls/:id/answers', auth, async (req, res) => {
      const { poll } = await this.loadPoll(req.params.id, req.user.id);
      const { answers } = req.body;

      if (!Array.isArray(answers)) throw badRequest('answers doit être un tableau');

      const seen = new Set();
      answers.forEach((a) => {
        const question = poll.questions.id(a?.question);
        if (!question) throw badRequest(`Question inconnue : ${a?.question}`);
        if (seen.has(String(question._id))) throw badRequest('Une seule réponse par question');
        if (!question.options.id(a.option)) throw badRequest(`Réponse inconnue pour la question "${question.label}"`);
        seen.add(String(question._id));
      });
      if (seen.size !== poll.questions.length) throw badRequest('Vous devez répondre à toutes les questions');

      const already = await this.PollAnswer.exists({ poll: poll._id, user: req.user.id });
      if (already) throw new HttpError(409, 'Vous avez déjà répondu à ce sondage');

      const result = await this.PollAnswer.create({
        poll: poll._id,
        user: req.user.id,
        answers: answers.map((a) => ({ question: a.question, option: a.option }))
      });
      res.status(201).json(result);
    });
  }

  results() {
    this.app.get('/polls/:id/results', auth, async (req, res) => {
      const { poll } = await this.loadPoll(req.params.id, req.user.id);
      const all = await this.PollAnswer.find({ poll: poll._id });

      const counts = {};
      all.forEach((a) => a.answers.forEach(({ option }) => {
        counts[String(option)] = (counts[String(option)] || 0) + 1;
      }));

      res.status(200).json({
        poll: poll._id,
        title: poll.title,
        total_answers: all.length,
        questions: poll.questions.map((q) => ({
          _id: q._id,
          label: q.label,
          options: q.options.map((o) => ({ _id: o._id, label: o.label, votes: counts[String(o._id)] || 0 }))
        }))
      });
    });
  }

  run() {
    this.create();
    this.list();
    this.getOne();
    this.remove();
    this.answer();
    this.results();
  }
};

export default Polls;
