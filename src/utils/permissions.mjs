

const includesId = (list = [], id) => list.some((item) => String(item?._id ?? item) === String(id));

export const isGroupAdmin = (group, userId) => includesId(group.administrators, userId);
export const isGroupMember = (group, userId) => isGroupAdmin(group, userId) || includesId(group.members, userId);

export const canSeeGroup = (group, userId) => group.type !== 'secret' || isGroupMember(group, userId);

export const canSeeGroupContent = (group, userId) => group.type === 'public' || isGroupMember(group, userId);

export const isOrganizer = (event, userId) => includesId(event.organizers, userId);
export const isParticipant = (event, userId) => isOrganizer(event, userId) || includesId(event.participants, userId);

export const canSeeEvent = (event, userId) => !event.is_private || isParticipant(event, userId);

export { includesId };
