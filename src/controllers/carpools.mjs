import auth from '../middlewares/auth.mjs';
import { pick, badRequest, forbidden, notFound, checkId, HttpError } from '../utils/http.mjs';
import { loadEvent } from '../utils/loaders.mjs';
import { includesId } from '../utils/permissions.mjs';

const FIELDS = ['departure_location', 'departure_time', 'price', 'seats_available', 'max_detour_minutes'];

const Carpools = class Carpools {
  constructor(app, models) {
    this.app = app;
    this.models = models;
    this.Carpool = models.Carpool;

    this.run();
  }

  async loadEnabledEvent(eventId, userId) {
    const event = await loadEvent(this.models, eventId, userId, 'participant');
    if (!event.carpooling_enabled) throw badRequest("Le covoiturage n'est pas activé pour cet événement");
    return event;
  }

  async loadCarpool(id, userId) {
    checkId(id);
    const carpool = await this.Carpool.findById(id);
    if (!carpool) throw notFound('Carpool');
    const event = await this.loadEnabledEvent(carpool.event, userId);
    return { carpool, event };
  }

  create() {
    this.app.post('/events/:id/carpools', auth, async (req, res) => {
      const event = await this.loadEnabledEvent(req.params.id, req.user.id);
      const data = pick(req.body, FIELDS);

      if (data.departure_time && new Date(data.departure_time) > event.end_date) {
        throw badRequest("Le départ doit avoir lieu avant la fin de l'événement");
      }
      if (await this.Carpool.exists({ event: event._id, driver: req.user.id })) {
        throw new HttpError(409, 'Vous proposez déjà un covoiturage pour cet événement');
      }

      const carpool = await this.Carpool.create({ ...data, event: event._id, driver: req.user.id });
      res.status(201).json(carpool);
    });
  }

  list() {
    this.app.get('/events/:id/carpools', auth, async (req, res) => {
      const event = await this.loadEnabledEvent(req.params.id, req.user.id);
      const carpools = await this.Carpool.find({ event: event._id })
        .populate('driver passengers', 'firstname lastname avatar').sort({ departure_time: 1 });
      res.status(200).json(carpools.map((c) => ({
        ...c.toObject(),
        seats_left: c.seats_available - c.passengers.length
      })));
    });
  }

  update() {
    this.app.patch('/carpools/:id', auth, async (req, res) => {
      const { carpool } = await this.loadCarpool(req.params.id, req.user.id);
      if (String(carpool.driver) !== req.user.id) throw forbidden('Seul le conducteur peut modifier ce trajet');

      const data = pick(req.body, FIELDS);
      if (data.seats_available !== undefined && Number(data.seats_available) < carpool.passengers.length) {
        throw badRequest('Il y a déjà plus de passagers que ce nombre de places');
      }
      carpool.set(data);
      await carpool.save();
      res.status(200).json(carpool);
    });
  }

  remove() {
    this.app.delete('/carpools/:id', auth, async (req, res) => {
      const { carpool } = await this.loadCarpool(req.params.id, req.user.id);
      if (String(carpool.driver) !== req.user.id) throw forbidden('Seul le conducteur peut supprimer ce trajet');
      await carpool.deleteOne();
      res.status(204).send();
    });
  }

  book() {
    this.app.post('/carpools/:id/passengers', auth, async (req, res) => {
      const { carpool } = await this.loadCarpool(req.params.id, req.user.id);
      if (String(carpool.driver) === req.user.id) throw badRequest('Vous êtes le conducteur de ce trajet');
      if (includesId(carpool.passengers, req.user.id)) throw new HttpError(409, 'Vous avez déjà une place');
      if (carpool.passengers.length >= carpool.seats_available) throw new HttpError(409, 'Plus de place disponible');

      carpool.passengers.push(req.user.id);
      await carpool.save();
      res.status(200).json(carpool);
    });
  }

  cancel() {
    this.app.delete('/carpools/:id/passengers', auth, async (req, res) => {
      const { carpool } = await this.loadCarpool(req.params.id, req.user.id);
      carpool.passengers.pull(req.user.id);
      await carpool.save();
      res.status(204).send();
    });
  }

  run() {
    this.create();
    this.list();
    this.update();
    this.remove();
    this.book();
    this.cancel();
  }
};

export default Carpools;
