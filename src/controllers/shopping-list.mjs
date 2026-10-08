import auth from '../middlewares/auth.mjs';
import { pick, badRequest, forbidden, notFound, checkId, HttpError } from '../utils/http.mjs';
import { loadEvent } from '../utils/loaders.mjs';
import { isOrganizer } from '../utils/permissions.mjs';

const ShoppingList = class ShoppingList {
  constructor(app, models) {
    this.app = app;
    this.models = models;
    this.Item = models.ShoppingItem;

    this.run();
  }

  async loadEnabledEvent(eventId, userId) {
    const event = await loadEvent(this.models, eventId, userId, 'participant');
    if (!event.shopping_list_enabled) throw badRequest("La shopping list n'est pas activée pour cet événement");
    return event;
  }

  async assertUnique(eventId, name, exceptId = null) {
    const key = String(name || '').trim().toLowerCase();
    const filter = { event: eventId, name_key: key };
    if (exceptId) filter._id = { $ne: exceptId };
    if (key && await this.Item.exists(filter)) {
      throw new HttpError(409, `"${name}" est déjà apporté par quelqu'un pour cet événement`);
    }
  }

  create() {
    this.app.post('/events/:id/shopping-items', auth, async (req, res) => {
      const event = await this.loadEnabledEvent(req.params.id, req.user.id);
      const data = pick(req.body, ['name', 'quantity', 'arrival_time']);
      await this.assertUnique(event._id, data.name);

      const item = await this.Item.create({ ...data, event: event._id, user: req.user.id });
      res.status(201).json(item);
    });
  }

  list() {
    this.app.get('/events/:id/shopping-items', auth, async (req, res) => {
      const event = await this.loadEnabledEvent(req.params.id, req.user.id);
      const items = await this.Item.find({ event: event._id }).populate('user', 'firstname lastname').sort({ name: 1 });
      res.status(200).json(items);
    });
  }

  async loadItem(itemId, userId) {
    checkId(itemId);
    const item = await this.Item.findById(itemId);
    if (!item) throw notFound('Shopping item');
    const event = await this.loadEnabledEvent(item.event, userId);
    if (String(item.user) !== userId && !isOrganizer(event, userId)) {
      throw forbidden("Seul l'auteur ou un organisateur peut modifier cet élément");
    }
    return item;
  }

  update() {
    this.app.patch('/shopping-items/:id', auth, async (req, res) => {
      const item = await this.loadItem(req.params.id, req.user.id);
      const data = pick(req.body, ['name', 'quantity', 'arrival_time']);
      if (data.name) await this.assertUnique(item.event, data.name, item._id);
      item.set(data);
      await item.save();
      res.status(200).json(item);
    });
  }

  remove() {
    this.app.delete('/shopping-items/:id', auth, async (req, res) => {
      const item = await this.loadItem(req.params.id, req.user.id);
      await item.deleteOne();
      res.status(204).send();
    });
  }

  run() {
    this.create();
    this.list();
    this.update();
    this.remove();
  }
};

export default ShoppingList;
