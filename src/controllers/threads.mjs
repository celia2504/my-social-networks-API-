import auth from '../middlewares/auth.mjs';
import { badRequest, forbidden, notFound, checkId, pagination } from '../utils/http.mjs';
import { loadEvent, loadGroup } from '../utils/loaders.mjs';
import { isGroupAdmin, isGroupMember, isOrganizer, isParticipant } from '../utils/permissions.mjs';

const Threads = class Threads {
  constructor(app, models) {
    this.app = app;
    this.models = models;
    this.Thread = models.Thread;
    this.Message = models.Message;

    this.run();
  }

  async loadThread(threadId, userId) {
    checkId(threadId, 'threadId');
    const thread = await this.Thread.findById(threadId);
    if (!thread) throw notFound('Thread');

    if (thread.group) {
      const group = await loadGroup(this.models, thread.group, userId);
      if (!isGroupMember(group, userId)) throw forbidden('Réservé aux membres du groupe');
      
      const canStartMessage = group.allow_members_to_post || isGroupAdmin(group, userId);
      return { thread, canStartMessage };
    }

    const event = await loadEvent(this.models, thread.event, userId);
    if (!isParticipant(event, userId)) throw forbidden("Réservé aux participants de l'événement");
    return { thread, canStartMessage: true, isModerator: isOrganizer(event, userId) };
  }

  getThreadOf() {
    this.app.get('/groups/:id/thread', auth, async (req, res) => {
      const group = await loadGroup(this.models, req.params.id, req.user.id, 'member');
      const thread = await this.Thread.findOne({ group: group._id });
      if (!thread) throw notFound('Thread');
      res.status(200).json(thread);
    });

    this.app.get('/events/:id/thread', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'participant');
      const thread = await this.Thread.findOne({ event: event._id });
      if (!thread) throw notFound('Thread');
      res.status(200).json(thread);
    });
  }

  listMessages() {
    this.app.get('/threads/:id/messages', auth, async (req, res) => {
      const { thread } = await this.loadThread(req.params.id, req.user.id);
      const { limit, skip, page } = pagination(req.query);

      const [messages, total] = await Promise.all([
        this.Message.find({ thread: thread._id })
          .populate('author', 'firstname lastname avatar')
          .sort({ created_at: 1 }).skip(skip).limit(limit),
        this.Message.countDocuments({ thread: thread._id })
      ]);

      res.status(200).json({ page, limit, total, data: messages });
    });
  }

  postMessage() {
    this.app.post('/threads/:id/messages', auth, async (req, res) => {
      const { thread, canStartMessage } = await this.loadThread(req.params.id, req.user.id);
      const parentId = req.body.parent_message || null;

      if (parentId) {
        checkId(parentId, 'parent_message');
        const parent = await this.Message.exists({ _id: parentId, thread: thread._id });
        if (!parent) throw badRequest("Le message auquel vous répondez n'existe pas dans ce fil");
      } else if (!canStartMessage) {
        throw forbidden('Seuls les administrateurs peuvent publier dans ce groupe (vous pouvez répondre aux messages)');
      }

      const message = await this.Message.create({
        thread: thread._id,
        author: req.user.id,
        content: req.body.content,
        parent_message: parentId
      });

      res.status(201).json(message);
    });
  }

  listReplies() {
    this.app.get('/threads/:id/messages/:messageId/replies', auth, async (req, res) => {
      const { thread } = await this.loadThread(req.params.id, req.user.id);
      checkId(req.params.messageId, 'messageId');
      const replies = await this.Message.find({ thread: thread._id, parent_message: req.params.messageId })
        .populate('author', 'firstname lastname avatar')
        .sort({ created_at: 1 });
      res.status(200).json(replies);
    });
  }

  deleteMessage() {
    this.app.delete('/threads/:id/messages/:messageId', auth, async (req, res) => {
      const { thread, isModerator } = await this.loadThread(req.params.id, req.user.id);
      checkId(req.params.messageId, 'messageId');
      const message = await this.Message.findOne({ _id: req.params.messageId, thread: thread._id });
      if (!message) throw notFound('Message');

      let allowed = String(message.author) === req.user.id || isModerator;
      if (!allowed && thread.group) {
        const group = await this.models.Group.findById(thread.group);
        allowed = isGroupAdmin(group, req.user.id);
      }
      if (!allowed) throw forbidden('Vous ne pouvez supprimer que vos propres messages');

      await this.Message.deleteMany({ parent_message: message._id });
      await message.deleteOne();
      res.status(204).send();
    });
  }

  run() {
    this.getThreadOf();
    this.listMessages();
    this.postMessage();
    this.listReplies();
    this.deleteMessage();
  }
};

export default Threads;
