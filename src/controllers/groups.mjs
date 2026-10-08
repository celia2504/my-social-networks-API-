import auth from '../middlewares/auth.mjs';
import { pick, badRequest, forbidden, checkId, pagination, escapeRegex } from '../utils/http.mjs';
import { uniqueIds, assertUsersExist, loadGroup, deleteEventCascade } from '../utils/loaders.mjs';
import { isGroupAdmin, isGroupMember, canSeeGroupContent } from '../utils/permissions.mjs';

const FIELDS = ['name', 'description', 'icon', 'cover_photo', 'type', 'allow_members_to_post', 'allow_members_to_create_events'];

const Groups = class Groups {
  constructor(app, models) {
    this.app = app;
    this.models = models;
    this.Group = models.Group;

    this.run();
  }

  create() {
    this.app.post('/groups', auth, async (req, res) => {
      const data = pick(req.body, FIELDS);
      const admins = uniqueIds(req.body.administrators, 'administrators');
      const members = uniqueIds(req.body.members, 'members');

      if (!admins.includes(req.user.id)) admins.unshift(req.user.id);
      
      const allMembers = [...new Set([...admins, ...members])];
      await assertUsersExist(this.models.User, allMembers);

      const group = await this.Group.create({
        ...data,
        administrators: admins,
        members: allMembers,
        created_by: req.user.id
      });

      await this.models.Thread.create({ group: group._id });

      res.status(201).json(group);
    });
  }

  
  list() {
    this.app.get('/groups', auth, async (req, res) => {
      const { limit, skip, page } = pagination(req.query);
      const me = req.user.id;

      const filter = {
        $or: [
          { type: { $in: ['public', 'private'] } },
          { members: me },
          { administrators: me }
        ]
      };
      if (req.query.q) filter.name = new RegExp(escapeRegex(req.query.q), 'i');
      if (req.query.type) filter.type = String(req.query.type);
      if (req.query.mine === 'true') filter.$or = [{ members: me }, { administrators: me }];

      const [groups, total] = await Promise.all([
        this.Group.find(filter).select('-members').sort({ created_at: -1 }).skip(skip).limit(limit),
        this.Group.countDocuments(filter)
      ]);

      res.status(200).json({ page, limit, total, data: groups });
    });
  }

  getOne() {
    this.app.get('/groups/:id', auth, async (req, res) => {
      const group = await loadGroup(this.models, req.params.id, req.user.id);
      const result = group.toObject();

      if (!canSeeGroupContent(group, req.user.id)) {
        result.members_count = group.members.length;
        delete result.members;
      } else {
        await group.populate('members administrators', 'firstname lastname avatar');
        Object.assign(result, group.toObject());
      }
      res.status(200).json(result);
    });
  }

  update() {
    this.app.patch('/groups/:id', auth, async (req, res) => {
      const group = await loadGroup(this.models, req.params.id, req.user.id, 'admin');
      group.set(pick(req.body, FIELDS));
      await group.save();
      res.status(200).json(group);
    });
  }

  remove() {
    this.app.delete('/groups/:id', auth, async (req, res) => {
      const group = await loadGroup(this.models, req.params.id, req.user.id, 'admin');

      const threads = await this.models.Thread.find({ group: group._id }).select('_id');
      await this.models.Message.deleteMany({ thread: { $in: threads.map((t) => t._id) } });
      await this.models.Thread.deleteMany({ group: group._id });

      const events = await this.models.Event.find({ group: group._id }).select('_id');
      await Promise.all(events.map((e) => deleteEventCascade(this.models, e._id)));

      await group.deleteOne();
      res.status(204).send();
    });
  }

  join() {
    this.app.post('/groups/:id/join', auth, async (req, res) => {
      const group = await loadGroup(this.models, req.params.id, req.user.id);
      if (group.type !== 'public') {
        throw forbidden('Groupe privé ou secret : seul un administrateur peut vous ajouter');
      }
      group.members.addToSet(req.user.id);
      await group.save();
      res.status(200).json(group);
    });
  }

  addMembers() {
    this.app.post('/groups/:id/members', auth, async (req, res) => {
      const group = await loadGroup(this.models, req.params.id, req.user.id, 'admin');
      const ids = uniqueIds(req.body.users, 'users');
      if (!ids.length) throw badRequest('users est obligatoire');
      await assertUsersExist(this.models.User, ids);

      ids.forEach((id) => group.members.addToSet(id));
      await group.save();
      res.status(200).json(group);
    });
  }

  removeMember() {
    this.app.delete('/groups/:id/members/:userId', auth, async (req, res) => {
      checkId(req.params.userId, 'userId');
      const group = await loadGroup(this.models, req.params.id, req.user.id, 'member');
      const target = req.params.userId;

      if (target !== req.user.id && !isGroupAdmin(group, req.user.id)) {
        throw forbidden('Seul un administrateur peut retirer un autre membre');
      }
      if (isGroupAdmin(group, target) && group.administrators.length === 1) {
        throw badRequest('Le groupe doit garder au moins 1 administrateur');
      }
      if (group.members.length === 1) {
        throw badRequest('Le groupe doit garder au moins 1 membre (supprimez plutôt le groupe)');
      }

      group.members.pull(target);
      group.administrators.pull(target);
      await group.save();
      res.status(204).send();
    });
  }

  addAdmin() {
    this.app.post('/groups/:id/administrators', auth, async (req, res) => {
      const group = await loadGroup(this.models, req.params.id, req.user.id, 'admin');
      const userId = checkId(req.body.user, 'user');
      if (!isGroupMember(group, userId)) throw badRequest("L'utilisateur doit d'abord être membre du groupe");

      group.administrators.addToSet(userId);
      await group.save();
      res.status(200).json(group);
    });
  }

  removeAdmin() {
    this.app.delete('/groups/:id/administrators/:userId', auth, async (req, res) => {
      checkId(req.params.userId, 'userId');
      const group = await loadGroup(this.models, req.params.id, req.user.id, 'admin');
      if (group.administrators.length === 1) throw badRequest('Le groupe doit garder au moins 1 administrateur');

      group.administrators.pull(req.params.userId);
      await group.save();
      res.status(204).send();
    });
  }

  run() {
    this.create();
    this.list();
    this.getOne();
    this.update();
    this.remove();
    this.join();
    this.addMembers();
    this.removeMember();
    this.addAdmin();
    this.removeAdmin();
  }
};

export default Groups;
