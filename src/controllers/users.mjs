import bcrypt from 'bcryptjs';
import validator from 'validator';
import auth from '../middlewares/auth.mjs';
import { pick, notFound, badRequest, checkId, pagination, escapeRegex } from '../utils/http.mjs';

const UPDATABLE_FIELDS = ['firstname', 'lastname', 'birthdate', 'avatar', 'bio', 'city', 'password'];

const Users = class Users {
  constructor(app, models) {
    this.app = app;
    this.models = models;
    this.User = models.User;

    this.run();
  }

  getMe() {
    this.app.get('/users/me', auth, async (req, res) => {
      const user = await this.User.findById(req.user.id);
      if (!user) throw notFound('User');
      res.status(200).json(user);
    });
  }

  getUsers() {
    this.app.get('/users', auth, async (req, res) => {
      const { limit, skip, page } = pagination(req.query);
      const filter = {};

      if (req.query.q) {
        const regex = new RegExp(escapeRegex(req.query.q), 'i');
        filter.$or = [{ firstname: regex }, { lastname: regex }];
      }

      const [users, total] = await Promise.all([
        this.User.find(filter).select('firstname lastname avatar city').skip(skip).limit(limit),
        this.User.countDocuments(filter)
      ]);

      res.status(200).json({ page, limit, total, data: users });
    });
  }

  getUserById() {
    this.app.get('/users/:id', auth, async (req, res) => {
      checkId(req.params.id);
      const user = await this.User.findById(req.params.id).select('-email');
      if (!user) throw notFound('User');
      res.status(200).json(user);
    });
  }

  updateMe() {
    this.app.patch('/users/me', auth, async (req, res) => {
      const data = pick(req.body, UPDATABLE_FIELDS);

      if (data.password !== undefined) {
        if (typeof data.password !== 'string' || !validator.isStrongPassword(data.password, { minSymbols: 0 })) {
          throw badRequest('Le mot de passe doit faire au moins 8 caractères avec une majuscule, une minuscule et un chiffre');
        }
        data.password = await bcrypt.hash(data.password, 10);
      }

      const user = await this.User.findById(req.user.id);
      if (!user) throw notFound('User');
      user.set(data);
      await user.save(); 

      const safeUser = user.toObject();
      delete safeUser.password;
      res.status(200).json(safeUser);
    });
  }

  deleteMe() {
    this.app.delete('/users/me', auth, async (req, res) => {
      const user = await this.User.findById(req.user.id);
      if (!user) throw notFound('User');
      await user.deleteOne();

      const pullUser = { $pull: { members: user._id, administrators: user._id } };
      await this.models.Group.updateMany({}, pullUser);
      await this.models.Event.updateMany({}, { $pull: { participants: user._id, organizers: user._id } });

      res.status(204).send();
    });
  }

  run() {
    this.getMe();
    this.updateMe();
    this.deleteMe();
    this.getUsers();
    this.getUserById();
  }
};

export default Users;
