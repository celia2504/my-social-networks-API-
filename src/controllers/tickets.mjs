import rateLimit from 'express-rate-limit';
import auth from '../middlewares/auth.mjs';
import { pick, badRequest, notFound, checkId, HttpError, pagination } from '../utils/http.mjs';
import { loadEvent } from '../utils/loaders.mjs';

const Tickets = class Tickets {
  constructor(app, models) {
    this.app = app;
    this.models = models;
    this.TicketType = models.TicketType;
    this.Ticket = models.Ticket;

    this.purchaseLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: { code: 429, message: "Trop de tentatives d'achat, réessayez plus tard" }
    });

    this.run();
  }

  async loadPublicTicketedEvent(eventId) {
    checkId(eventId, 'eventId');
    const event = await this.models.Event.findById(eventId);
    if (!event || event.is_private) throw notFound('Event');
    if (!event.ticketing_enabled) throw badRequest("Cet événement n'a pas de billetterie");
    return event;
  }

  createType() {
    this.app.post('/events/:id/ticket-types', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'organizer');
      if (!event.ticketing_enabled) {
        throw badRequest("Activez d'abord la billetterie (ticketing_enabled: true) sur cet événement public");
      }
      const type = await this.TicketType.create({ ...pick(req.body, ['name', 'price', 'quantity']), event: event._id });
      res.status(201).json(type);
    });
  }

  listTypes() {
    this.app.get('/events/:id/ticket-types', async (req, res) => {
      const event = await this.loadPublicTicketedEvent(req.params.id);
      const types = await this.TicketType.find({ event: event._id }).sort({ price: 1 });
      res.status(200).json(types);
    });
  }

  updateType() {
    this.app.patch('/ticket-types/:id', auth, async (req, res) => {
      checkId(req.params.id);
      const type = await this.TicketType.findById(req.params.id);
      if (!type) throw notFound('Ticket type');
      await loadEvent(this.models, type.event, req.user.id, 'organizer');

      const data = pick(req.body, ['name', 'price', 'quantity']);
      if (data.quantity !== undefined) {
        const sold = type.quantity - type.remaining;
        if (Number(data.quantity) < sold) throw badRequest(`Impossible : ${sold} billets déjà vendus`);
        data.remaining = Number(data.quantity) - sold;
      }
      type.set(data);
      await type.save();
      res.status(200).json(type);
    });
  }

  deleteType() {
    this.app.delete('/ticket-types/:id', auth, async (req, res) => {
      checkId(req.params.id);
      const type = await this.TicketType.findById(req.params.id);
      if (!type) throw notFound('Ticket type');
      await loadEvent(this.models, type.event, req.user.id, 'organizer');

      if (await this.Ticket.exists({ ticket_type: type._id })) {
        throw new HttpError(409, 'Des billets de ce type ont déjà été vendus');
      }
      await type.deleteOne();
      res.status(204).send();
    });
  }

  purchase() {
    this.app.post('/events/:id/tickets', this.purchaseLimiter, async (req, res) => {
      const event = await this.loadPublicTicketedEvent(req.params.id);
      const typeId = checkId(req.body.ticket_type, 'ticket_type');
      const buyer = req.body.buyer || {};

      
      const ticket = new this.Ticket({ event: event._id, ticket_type: typeId, buyer });
      await ticket.validate();

      
      if (await this.Ticket.exists({ event: event._id, 'buyer.email': ticket.buyer.email })) {
        throw new HttpError(409, 'Cette personne possède déjà un billet pour cet événement');
      }

     
      const type = await this.TicketType.findOneAndUpdate(
        { _id: typeId, event: event._id, remaining: { $gt: 0 } },
        { $inc: { remaining: -1 } },
        { new: true }
      );
      if (!type) {
        const exists = await this.TicketType.exists({ _id: typeId, event: event._id });
        if (!exists) throw badRequest('Type de billet inconnu pour cet événement');
        throw new HttpError(409, 'Plus de billets disponibles pour ce type');
      }

      try {
        await ticket.save();
      } catch (err) {
        
        await this.TicketType.updateOne({ _id: typeId }, { $inc: { remaining: 1 } });
        throw err;
      }

      res.status(201).json({ ...ticket.toObject(), ticket_type: { _id: type._id, name: type.name, price: type.price } });
    });
  }

  listSold() {
    this.app.get('/events/:id/tickets', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'organizer');
      const { limit, skip, page } = pagination(req.query);
      const [tickets, total] = await Promise.all([
        this.Ticket.find({ event: event._id }).populate('ticket_type', 'name price')
          .sort({ purchased_at: -1 }).skip(skip).limit(limit),
        this.Ticket.countDocuments({ event: event._id })
      ]);
      res.status(200).json({ page, limit, total, data: tickets });
    });
  }

  run() {
    this.createType();
    this.listTypes();
    this.updateType();
    this.deleteType();
    this.purchase();
    this.listSold();
  }
};

export default Tickets;
