

const BASE = process.env.API_URL || 'http://localhost:3000';
const run = Date.now();
let failures = 0;

const call = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

const expect = (label, res, status) => {
  const ok = res.status === status;
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK    ' : 'ECHEC '} [${res.status}${ok ? '' : ` attendu ${status}`}] ${label}`);
  if (!ok) console.log('       ', JSON.stringify(res.body));
  return res.body;
};

const register = async (firstname) => {
  const body = expect(`inscription ${firstname}`, await call('POST', '/auth/register', {
    firstname, lastname: 'Test', email: `${firstname.toLowerCase()}.${run}@mail.com`, password: 'Password123'
  }), 201);
  return { id: body.user._id, token: body.token };
};

const main = async () => {
  console.log('--- Utilisateurs ---');
  const alice = await register('Alice');
  const bob = await register('Bob');
  const chloe = await register('Chloe');
  expect('email déjà utilisé -> 409', await call('POST', '/auth/register', {
    firstname: 'Alice', lastname: 'Bis', email: `alice.${run}@mail.com`, password: 'Password123'
  }), 409);
  expect('email invalide -> 400', await call('POST', '/auth/register', {
    firstname: 'X', lastname: 'Y', email: 'pas-un-email', password: 'Password123'
  }), 400);
  expect('mot de passe faible -> 400', await call('POST', '/auth/register', {
    firstname: 'X', lastname: 'Y', email: `x.${run}@mail.com`, password: '123'
  }), 400);
  expect('login OK', await call('POST', '/auth/login', { email: `alice.${run}@mail.com`, password: 'Password123' }), 200);
  expect('login mauvais mdp -> 401', await call('POST', '/auth/login', { email: `alice.${run}@mail.com`, password: 'Wrong123' }), 401);
  expect('route protégée sans token -> 401', await call('GET', '/users/me'), 401);
  const me = expect('GET /users/me', await call('GET', '/users/me', null, alice.token), 200);
  if (me && me.password) { failures += 1; console.log('ECHEC  le mot de passe ne doit pas être renvoyé'); }
  expect('PATCH /users/me', await call('PATCH', '/users/me', { city: 'Lyon' }, alice.token), 200);

  console.log('--- Groupes ---');
  const group = expect('créer groupe privé', await call('POST', '/groups', {
    name: 'Les randonneurs', type: 'private', members: [bob.id], allow_members_to_post: false, allow_members_to_create_events: true
  }, alice.token), 201);
  expect('type de groupe invalide -> 400', await call('POST', '/groups', { name: 'Test', type: 'cache' }, alice.token), 400);
  const secret = expect('créer groupe secret', await call('POST', '/groups', { name: 'Club secret', type: 'secret' }, alice.token), 201);
  expect('groupe secret invisible pour Chloé -> 404', await call('GET', `/groups/${secret._id}`, null, chloe.token), 404);
  expect('Chloé ne peut pas rejoindre un groupe privé -> 403', await call('POST', `/groups/${group._id}/join`, null, chloe.token), 403);
  expect('Bob (membre) ne peut pas modifier -> 403', await call('PATCH', `/groups/${group._id}`, { name: 'Hack' }, bob.token), 403);
  expect('Alice ajoute Chloé', await call('POST', `/groups/${group._id}/members`, { users: [chloe.id] }, alice.token), 200);

  console.log('--- Fil de discussion du groupe ---');
  const gThread = expect('GET fil du groupe', await call('GET', `/groups/${group._id}/thread`, null, bob.token), 200);
  const msg = expect('Alice (admin) publie', await call('POST', `/threads/${gThread._id}/messages`, { content: 'Bienvenue !' }, alice.token), 201);
  expect('Bob ne peut pas lancer un message (publication désactivée) -> 403',
    await call('POST', `/threads/${gThread._id}/messages`, { content: 'Salut' }, bob.token), 403);
  expect('Bob peut répondre', await call('POST', `/threads/${gThread._id}/messages`, { content: 'Merci !', parent_message: msg._id }, bob.token), 201);
  expect('lister les messages', await call('GET', `/threads/${gThread._id}/messages`, null, chloe.token), 200);

  console.log('--- Événements ---');
  expect('date de fin avant début -> 400', await call('POST', '/events', {
    name: 'Mauvais', location: 'Paris', start_date: '2027-06-10T10:00:00Z', end_date: '2027-06-09T10:00:00Z'
  }, alice.token), 400);
  const gEvent = expect('Bob crée un événement dans le groupe (membres invités auto)', await call('POST', '/events', {
    name: 'Rando du Vercors', location: 'Vercors', start_date: '2027-06-10T08:00:00Z', end_date: '2027-06-10T18:00:00Z', group: group._id
  }, bob.token), 201);
  if (gEvent && (!gEvent.is_private || gEvent.participants.length !== 2)) {
    failures += 1; console.log('ECHEC  événement de groupe privé : doit être privé avec 2 participants invités');
  }
  const event = expect('créer événement public avec options', await call('POST', '/events', {
    name: 'Festival de Lyon', description: 'Concerts', location: 'Lyon', start_date: '2027-07-01T14:00:00Z',
    end_date: '2027-07-02T02:00:00Z', cover_photo: 'https://img.com/c.jpg', is_private: false,
    ticketing_enabled: true, shopping_list_enabled: true, carpooling_enabled: true
  }, alice.token), 201);
  expect('billetterie sur événement privé -> 400', await call('POST', '/events', {
    name: 'Privé', location: 'Paris', start_date: '2027-06-10T10:00:00Z', end_date: '2027-06-11T10:00:00Z',
    is_private: true, ticketing_enabled: true
  }, alice.token), 400);
  expect('liste des événements', await call('GET', '/events?q=festival', null, chloe.token), 200);
  expect('Bob rejoint l\'événement public', await call('POST', `/events/${event._id}/join`, null, bob.token), 200);
  expect('Chloé rejoint l\'événement public', await call('POST', `/events/${event._id}/join`, null, chloe.token), 200);
  expect('Bob ne peut pas modifier (pas organisateur) -> 403', await call('PATCH', `/events/${event._id}`, { name: 'X' }, bob.token), 403);
  expect('liens de partage', await call('GET', `/events/${event._id}/share`, null, alice.token), 200);
  expect('partage refusé événement privé -> 403', await call('GET', `/events/${gEvent._id}/share`, null, bob.token), 403);

  console.log('--- Fil de l\'événement ---');
  const eThread = expect('GET fil de l\'événement', await call('GET', `/events/${event._id}/thread`, null, bob.token), 200);
  expect('Bob poste', await call('POST', `/threads/${eThread._id}/messages`, { content: 'Hâte !' }, bob.token), 201);
  expect('message vide -> 400', await call('POST', `/threads/${eThread._id}/messages`, { content: '' }, bob.token), 400);

  console.log('--- Albums / photos / commentaires ---');
  const album = expect('créer album', await call('POST', `/events/${event._id}/albums`, { title: 'Jour 1' }, alice.token), 201);
  const photo = expect('Bob poste une photo', await call('POST', `/albums/${album._id}/photos`, { url: 'https://img.com/1.jpg', caption: 'Scène' }, bob.token), 201);
  expect('URL invalide -> 400', await call('POST', `/albums/${album._id}/photos`, { url: 'pas une url' }, bob.token), 400);
  expect('Chloé commente', await call('POST', `/photos/${photo._id}/comments`, { content: 'Top !' }, chloe.token), 201);
  expect('lister commentaires', await call('GET', `/photos/${photo._id}/comments`, null, alice.token), 200);

  console.log('--- Sondages ---');
  expect('Bob (participant) ne peut pas créer de sondage -> 403', await call('POST', `/events/${event._id}/polls`, {
    title: 'X', questions: [{ label: 'Q', options: ['A', 'B'] }]
  }, bob.token), 403);
  expect('question avec 1 seule réponse -> 400', await call('POST', `/events/${event._id}/polls`, {
    title: 'X', questions: [{ label: 'Q', options: ['A'] }]
  }, alice.token), 400);
  const poll = expect('créer sondage', await call('POST', `/events/${event._id}/polls`, {
    title: 'Organisation', questions: [
      { label: 'Repas ?', options: ['Pizza', 'Sushi', 'Burger'] },
      { label: 'Heure ?', options: ['18h', '20h'] }
    ]
  }, alice.token), 201);
  const answers = [
    { question: poll.questions[0]._id, option: poll.questions[0].options[1]._id },
    { question: poll.questions[1]._id, option: poll.questions[1].options[0]._id }
  ];
  expect('réponse incomplète -> 400', await call('POST', `/polls/${poll._id}/answers`, { answers: [answers[0]] }, bob.token), 400);
  expect('Bob répond', await call('POST', `/polls/${poll._id}/answers`, { answers }, bob.token), 201);
  expect('Bob répond 2 fois -> 409', await call('POST', `/polls/${poll._id}/answers`, { answers }, bob.token), 409);
  expect('résultats', await call('GET', `/polls/${poll._id}/results`, null, alice.token), 200);

  console.log('--- Billetterie ---');
  const tType = expect('créer type de billet', await call('POST', `/events/${event._id}/ticket-types`, { name: 'VIP', price: 50, quantity: 1 }, alice.token), 201);
  expect('montant négatif -> 400', await call('POST', `/events/${event._id}/ticket-types`, { name: 'X', price: -5, quantity: 10 }, alice.token), 400);
  expect('voir les billets (sans compte)', await call('GET', `/events/${event._id}/ticket-types`), 200);
  const buyer = (email) => ({
    ticket_type: tType._id,
    buyer: { firstname: 'Jean', lastname: 'Dupont', email, address: { street: '1 rue de la Paix', zip_code: '75001', city: 'Paris', country: 'France' } }
  });
  expect('achat sans compte', await call('POST', `/events/${event._id}/tickets`, buyer(`jean.${run}@mail.com`)), 201);
  expect('2e billet même personne -> 409', await call('POST', `/events/${event._id}/tickets`, buyer(`jean.${run}@mail.com`)), 409);
  expect('plus de stock -> 409', await call('POST', `/events/${event._id}/tickets`, buyer(`paul.${run}@mail.com`)), 409);
  expect('adresse manquante -> 400', await call('POST', `/events/${event._id}/tickets`, {
    ticket_type: tType._id, buyer: { firstname: 'A', lastname: 'B', email: `ab.${run}@mail.com` }
  }), 400);
  expect('organisateur voit les ventes', await call('GET', `/events/${event._id}/tickets`, null, alice.token), 200);

  console.log('--- Bonus : shopping list ---');
  expect('Bob apporte des chips', await call('POST', `/events/${event._id}/shopping-items`, { name: 'Chips', quantity: 3, arrival_time: '18:30' }, bob.token), 201);
  expect('"chips" en double -> 409', await call('POST', `/events/${event._id}/shopping-items`, { name: 'chips', quantity: 1, arrival_time: '19:00' }, chloe.token), 409);
  expect('heure invalide -> 400', await call('POST', `/events/${event._id}/shopping-items`, { name: 'Coca', quantity: 1, arrival_time: '25h' }, chloe.token), 400);

  console.log('--- Bonus : covoiturage ---');
  const carpool = expect('Alice propose un trajet', await call('POST', `/events/${event._id}/carpools`, {
    departure_location: 'Grenoble', departure_time: '2027-07-01T11:00:00Z', price: 10, seats_available: 1, max_detour_minutes: 30
  }, alice.token), 201);
  expect('Bob réserve', await call('POST', `/carpools/${carpool._id}/passengers`, null, bob.token), 200);
  expect('Chloé : complet -> 409', await call('POST', `/carpools/${carpool._id}/passengers`, null, chloe.token), 409);
  expect('liste des trajets', await call('GET', `/events/${event._id}/carpools`, null, chloe.token), 200);

  console.log('--- Divers ---');
  expect('id invalide -> 400', await call('GET', '/events/123', null, alice.token), 400);
  expect('route inconnue -> 404', await call('GET', '/nimportequoi'), 404);
  expect('suppression événement (cascade)', await call('DELETE', `/events/${event._id}`, null, alice.token), 204);
  expect('événement supprimé -> 404', await call('GET', `/events/${event._id}`, null, alice.token), 404);

  console.log(failures ? `\n${failures} test(s) en échec` : '\nTous les tests sont OK');
  process.exit(failures ? 1 : 0);
};

main().catch((err) => {
  console.error('Erreur : l\'API est-elle lancée ?', err.message);
  process.exit(1);
});
