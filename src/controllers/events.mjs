import auth from '../middlewares/auth.mjs';
import { pick, badRequest, forbidden, checkId, pagination, escapeRegex } from '../utils/http.mjs';
import { uniqueIds, assertUsersExist, loadEvent, loadGroup, deleteEventCascade } from '../utils/loaders.mjs';
import { isGroupAdmin, isOrganizer } from '../utils/permissions.mjs';

const FIELDS = [
  'name', 'description', 'start_date', 'end_date', 'location', 'cover_photo', 'is_private',
  'ticketing_enabled', 'shopping_list_enabled', 'carpooling_enabled'
];

const Events = class Events {
  constructor(app, models, config) {
    this.app = app;
    this.models = models;
    this.Event = models.Event;
    this.config = config;

    this.run();
  }

  create() {
    this.app.post('/events', auth, async (req, res) => {
      const data = pick(req.body, FIELDS);
      const organizers = uniqueIds(req.body.organizers, 'organizers');
      let participants = uniqueIds(req.body.participants, 'participants');

      if (!organizers.includes(req.user.id)) organizers.unshift(req.user.id);

      if (req.body.group) {
        const group = await loadGroup(this.models, req.body.group, req.user.id, 'member');

        if (!isGroupAdmin(group, req.user.id) && !group.allow_members_to_create_events) {
          throw forbidden("Les membres de ce groupe n'ont pas le droit de créer des événements");
        }
        data.group = group._id;

        if (group.type !== 'public') data.is_private = true;

        if (req.body.invite_group_members !== false) {
          participants = [...new Set([...participants, ...group.members.map(String)])];
        }
      }

      participants = participants.filter((id) => !organizers.includes(id));
      await assertUsersExist(this.models.User, [...organizers, ...participants]);

      const event = await this.Event.create({
        ...data,
        organizers,
        participants,
        created_by: req.user.id
      });

      await this.models.Thread.create({ event: event._id });

      res.status(201).json(event);
    });
  }

  list() {
    this.app.get('/events', auth, async (req, res) => {
      const { limit, skip, page } = pagination(req.query);
      const me = req.user.id;

      const and = [{ $or: [{ is_private: false }, { organizers: me }, { participants: me }] }];
      if (req.query.mine === 'true') and.push({ $or: [{ organizers: me }, { participants: me }] });
      if (req.query.q) and.push({ name: new RegExp(escapeRegex(req.query.q), 'i') });
      if (req.query.group) and.push({ group: checkId(req.query.group, 'group') });
      if (req.query.from) and.push({ end_date: { $gte: new Date(req.query.from) } });
      if (req.query.to) and.push({ start_date: { $lte: new Date(req.query.to) } });

      const filter = { $and: and };
      const [events, total] = await Promise.all([
        this.Event.find(filter).select('-participants').sort({ start_date: 1 }).skip(skip).limit(limit),
        this.Event.countDocuments(filter)
      ]);

      res.status(200).json({ page, limit, total, data: events });
    });
  }

  getOne() {
    this.app.get('/events/:id', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id);
      await event.populate('organizers participants', 'firstname lastname avatar');
      res.status(200).json(event);
    });
  }

  update() {
    this.app.patch('/events/:id', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'organizer');
      event.set(pick(req.body, FIELDS));

      if (event.group && !event.is_private) {
        const group = await this.models.Group.findById(event.group);
        if (group && group.type !== 'public') throw badRequest("Un événement d'un groupe privé ou secret doit rester privé");
      }
      await event.save();
      res.status(200).json(event);
    });
  }

  remove() {
    this.app.delete('/events/:id', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'organizer');
      await deleteEventCascade(this.models, event._id);
      res.status(204).send();
    });
  }

  join() {
    this.app.post('/events/:id/join', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id);
      if (event.is_private) throw forbidden('Événement privé : seul un organisateur peut vous inviter');
      if (!isOrganizer(event, req.user.id)) event.participants.addToSet(req.user.id);
      await event.save();
      res.status(200).json(event);
    });
  }

  addParticipants() {
    this.app.post('/events/:id/participants', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'organizer');
      const ids = uniqueIds(req.body.users, 'users');
      if (!ids.length) throw badRequest('users est obligatoire');
      await assertUsersExist(this.models.User, ids);

      ids.filter((id) => !isOrganizer(event, id)).forEach((id) => event.participants.addToSet(id));
      await event.save();
      res.status(200).json(event);
    });
  }

  inviteGroup() {
    this.app.post('/events/:id/invite-group', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'organizer');
      if (!event.group) throw badRequest("Cet événement n'est pas lié à un groupe");

      const group = await this.models.Group.findById(event.group);
      if (!group) throw badRequest('Le groupe de cet événement n\'existe plus');

      group.members.filter((id) => !isOrganizer(event, id)).forEach((id) => event.participants.addToSet(id));
      await event.save();
      res.status(200).json(event);
    });
  }

  removeParticipant() {
    this.app.delete('/events/:id/participants/:userId', auth, async (req, res) => {
      checkId(req.params.userId, 'userId');
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'participant');
      if (req.params.userId !== req.user.id && !isOrganizer(event, req.user.id)) {
        throw forbidden('Seul un organisateur peut retirer un autre participant');
      }
      event.participants.pull(req.params.userId);
      await event.save();
      res.status(204).send();
    });
  }

  addOrganizer() {
    this.app.post('/events/:id/organizers', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'organizer');
      const userId = checkId(req.body.user, 'user');
      await assertUsersExist(this.models.User, [userId]);

      event.organizers.addToSet(userId);
      event.participants.pull(userId);
      await event.save();
      res.status(200).json(event);
    });
  }

  removeOrganizer() {
    this.app.delete('/events/:id/organizers/:userId', auth, async (req, res) => {
      checkId(req.params.userId, 'userId');
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'organizer');
      if (event.organizers.length === 1) throw badRequest("L'événement doit garder au moins 1 organisateur");

      event.organizers.pull(req.params.userId);
      await event.save();
      res.status(204).send();
    });
  }

  share() {
    this.app.get('/events/:id/share', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'organizer');
      if (event.is_private) throw forbidden('Un événement privé ne peut pas être partagé');

      if (event.group) {
        const group = await this.models.Group.findById(event.group);
        if (!group || group.type !== 'public') throw forbidden('Partage possible uniquement depuis un groupe public');
      }

      const url = encodeURIComponent(`${this.config.publicBaseUrl}/events/${event._id}`);
      const text = encodeURIComponent(event.name);

      res.status(200).json({
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
        x: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
        whatsapp: `https://wa.me/?text=${text}%20${url}`
      });
    });
  }

  run() {
    this.create();
    this.list();
    this.getOne();
    this.update();
    this.remove();
    this.join();
    this.addParticipants();
    this.inviteGroup();
    this.removeParticipant();
    this.addOrganizer();
    this.removeOrganizer();
    this.share();
  }
};

export default Events;
