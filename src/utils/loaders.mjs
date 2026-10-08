import { badRequest, notFound, forbidden, checkId } from './http.mjs';
import {
  canSeeEvent, isParticipant, isOrganizer,
  canSeeGroup, isGroupMember, isGroupAdmin
} from './permissions.mjs';

export const uniqueIds = (list, name = 'ids') => {
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw badRequest(`${name} doit être un tableau d'ids`);
  list.forEach((id) => checkId(id, name));
  return [...new Set(list.map(String))];
};

export const assertUsersExist = async (User, ids) => {
  if (!ids.length) return;
  const count = await User.countDocuments({ _id: { $in: ids } });
  if (count !== ids.length) throw badRequest('Un ou plusieurs utilisateurs sont introuvables');
};

export const loadEvent = async (models, eventId, userId, role = 'viewer') => {
  checkId(eventId, 'eventId');
  const event = await models.Event.findById(eventId);

  if (!event || !canSeeEvent(event, userId)) throw notFound('Event');

  if (role === 'participant' && !isParticipant(event, userId)) {
    throw forbidden("Réservé aux participants de l'événement");
  }
  if (role === 'organizer' && !isOrganizer(event, userId)) {
    throw forbidden("Réservé aux organisateurs de l'événement");
  }
  return event;
};

export const loadGroup = async (models, groupId, userId, role = 'viewer') => {
  checkId(groupId, 'groupId');
  const group = await models.Group.findById(groupId);

  if (!group || !canSeeGroup(group, userId)) throw notFound('Group');

  if (role === 'member' && !isGroupMember(group, userId)) {
    throw forbidden('Réservé aux membres du groupe');
  }
  if (role === 'admin' && !isGroupAdmin(group, userId)) {
    throw forbidden('Réservé aux administrateurs du groupe');
  }
  return group;
};

export const deleteEventCascade = async (models, eventId) => {
  const albums = await models.Album.find({ event: eventId }).select('_id');
  const photos = await models.Photo.find({ album: { $in: albums.map((a) => a._id) } }).select('_id');
  const polls = await models.Poll.find({ event: eventId }).select('_id');
  const threads = await models.Thread.find({ event: eventId }).select('_id');

  await Promise.all([
    models.Comment.deleteMany({ photo: { $in: photos.map((p) => p._id) } }),
    models.Photo.deleteMany({ album: { $in: albums.map((a) => a._id) } }),
    models.Album.deleteMany({ event: eventId }),
    models.PollAnswer.deleteMany({ poll: { $in: polls.map((p) => p._id) } }),
    models.Poll.deleteMany({ event: eventId }),
    models.Message.deleteMany({ thread: { $in: threads.map((t) => t._id) } }),
    models.Thread.deleteMany({ event: eventId }),
    models.TicketType.deleteMany({ event: eventId }),
    models.Ticket.deleteMany({ event: eventId }),
    models.ShoppingItem.deleteMany({ event: eventId }),
    models.Carpool.deleteMany({ event: eventId })
  ]);
  await models.Event.deleteOne({ _id: eventId });
};
