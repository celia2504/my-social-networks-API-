# My Social Networks API

API REST (Node.js + Express + MongoDB/Mongoose) pour gérer des **événements**, des **groupes**, des **fils de discussion**, des **albums photo**, des **sondages**, une **billetterie**, ainsi que les bonus **shopping list** et **covoiturage**.

---

## 1. Installation

```bash
npm install
cp .env.example .env      # puis remplir les valeurs (MONGODB_URI, JWT_SECRET)
npm start                 # ou "npm run dev" pour relancer automatiquement à chaque modification
```

L'API écoute sur `http://localhost:3000`.

Pour tester toute l'API automatiquement (API lancée dans un autre terminal) :

```bash
npm run test:e2e
```

### Variables d'environnement (`.env`)

| Variable | Description | Exemple |
|---|---|---|
| `PORT` | Port d'écoute | `3000` |
| `MONGODB_URI` | Adresse de la base MongoDB | `mongodb://127.0.0.1:27017/my_social_networks` |
| `JWT_SECRET` | Clé secrète de signature des tokens | longue chaîne aléatoire |
| `JWT_EXPIRES_IN` | Durée de validité du token | `2h` |
| `USE_HTTPS` | `true` pour HTTPS (fichiers `cert/server.key` et `cert/server.crt`) | `false` |
| `PUBLIC_BASE_URL` | URL publique (liens de partage) | `http://localhost:3000` |

---

## 2. Architecture

```
index.mjs                    point d'entrée
config/config.mjs            configuration (lue depuis .env)
src/controllers/server.mjs   connexion MongoDB, middlewares, routes, gestion d'erreurs
src/controllers/*.mjs        un contrôleur (classe) par ressource
src/models/*.mjs             un schéma Mongoose par collection
src/middlewares/auth.mjs     vérification du token JWT
src/utils/                   validators, permissions, gestion des erreurs HTTP
scripts/e2e.mjs              tests de bout en bout
```

### Collections MongoDB

| Collection | Contenu |
|---|---|
| `users` | utilisateurs (email unique, mot de passe haché avec bcrypt) |
| `groups` | groupes (administrateurs, membres, paramètres) |
| `events` | événements (organisateurs, participants, options) |
| `threads` | fils de discussion (liés à 1 groupe **ou** 1 événement) |
| `messages` | messages d'un fil (avec `parent_message` pour les réponses) |
| `albums` / `photos` / `comments` | albums d'un événement, photos, commentaires |
| `polls` / `poll_answers` | sondages (questions + réponses possibles) et votes |
| `ticket_types` / `tickets` | types de billets et billets achetés |
| `shopping_items` | (bonus) ce que chacun apporte |
| `carpools` | (bonus) trajets de covoiturage |

---

## 3. Conventions

- Format : JSON (`Content-Type: application/json`).
- Authentification : header `Authorization: Bearer <token>` (token obtenu via `/auth/register` ou `/auth/login`). Les routes marquées 🔒 l'exigent.
- Pagination des listes : `?page=1&limit=20` (max 100). Réponse : `{ page, limit, total, data: [...] }`.
- Dates au format ISO 8601 : `2027-07-01T14:00:00Z`.
- Format des erreurs :

```json
{ "code": 400, "message": "Validation error", "details": [{ "field": "email", "message": "abc n'est pas un email valide" }] }
```

| Code | Signification |
|---|---|
| 200 / 201 / 204 | OK / créé / supprimé (sans contenu) |
| 400 | données invalides (validation, id mal formé, JSON invalide) |
| 401 | token manquant/invalide ou identifiants incorrects |
| 403 | connecté mais pas le droit (ex : pas organisateur) |
| 404 | introuvable (ou privé/secret et vous n'en faites pas partie) |
| 409 | conflit (email déjà utilisé, billet déjà acheté, plus de places, …) |
| 429 | trop de requêtes (anti brute-force) |

---

## 4. Règles métier (choix de conception)

**Utilisateurs** : prénom, nom, email (unique), mot de passe (8 caractères min. avec majuscule, minuscule, chiffre ; stocké haché, jamais renvoyé), date de naissance, avatar (URL), bio, ville.

**Groupes**
- `type` : `public` (tout le monde le voit et peut le rejoindre), `private` (visible mais seuls les admins ajoutent des membres ; contenu réservé aux membres), `secret` (invisible pour les non-membres → 404).
- Le créateur devient administrateur. Il reste toujours ≥ 1 administrateur et ≥ 1 membre.
- `allow_members_to_post: false` → seuls les admins lancent un message dans le fil ; les membres peuvent toujours **répondre**.
- `allow_members_to_create_events: false` → seuls les admins créent des événements dans le groupe.

**Événements**
- Le créateur devient organisateur. Il reste toujours ≥ 1 organisateur.
- `end_date` doit être après `start_date`.
- Créé dans un groupe : tous les membres sont **invités automatiquement** (désactivable avec `"invite_group_members": false`, puis possible en 1 clic avec `POST /events/:id/invite-group`). Un événement d'un groupe privé/secret est forcément privé.
- Événement privé : invisible (404) pour les non-participants ; on y entre seulement sur invitation d'un organisateur.
- Partage sur les réseaux sociaux (`/events/:id/share`) : seulement pour un événement public, et s'il appartient à un groupe, ce groupe doit être public.

**Fils de discussion** : créés automatiquement avec chaque groupe et chaque événement. Un fil est lié à 1 groupe **ou** 1 événement (validator). Réservés aux membres / participants.

**Albums** : liés à 1 événement. Seuls les participants (organisateurs inclus) peuvent voir, créer un album, poster une photo et commenter.

**Sondages** : créés par un organisateur ; ≥ 1 question ; ≥ 2 réponses possibles par question. Chaque participant répond une seule fois, en choisissant exactement 1 réponse pour chaque question.

**Billetterie** : seulement pour un événement **public** avec `ticketing_enabled: true`. Un organisateur crée des types de billets (nom, montant ≥ 0, quantité ≥ 1). Une personne extérieure **sans compte** achète un billet ; elle est identifiée par son email → **1 seul billet par personne et par événement**. Le stock est décrémenté de façon atomique (impossible de vendre plus que la quantité).

**Bonus** : shopping list (`shopping_list_enabled: true`, chaque objet unique par événement, insensible à la casse) et covoiturage (`carpooling_enabled: true`, un trajet par conducteur et par événement, réservation de places).

---

## 5. Endpoints

### Authentification

| Méthode | Route | Description |
|---|---|---|
| POST | `/auth/register` | Créer un compte → `{ user, token }` |
| POST | `/auth/login` | Se connecter → `{ token }` |

```json
// POST /auth/register
{ "firstname": "Alice", "lastname": "Martin", "email": "alice@mail.com", "password": "Password123",
  "birthdate": "1999-05-12", "avatar": "https://img.com/a.jpg", "bio": "...", "city": "Lyon" }

// POST /auth/login
{ "email": "alice@mail.com", "password": "Password123" }
```

### Utilisateurs 🔒

| Méthode | Route | Description |
|---|---|---|
| GET | `/users/me` | Mon profil |
| PATCH | `/users/me` | Modifier mon profil (firstname, lastname, birthdate, avatar, bio, city, password) |
| DELETE | `/users/me` | Supprimer mon compte |
| GET | `/users?q=martin` | Rechercher des utilisateurs |
| GET | `/users/:id` | Profil public d'un utilisateur |

### Groupes 🔒

| Méthode | Route | Qui | Description |
|---|---|---|---|
| POST | `/groups` | connecté | Créer un groupe |
| GET | `/groups?q=&type=&mine=true` | connecté | Lister les groupes visibles |
| GET | `/groups/:id` | visible | Détail d'un groupe |
| PATCH | `/groups/:id` | admin | Modifier les paramètres |
| DELETE | `/groups/:id` | admin | Supprimer (avec fil et événements du groupe) |
| POST | `/groups/:id/join` | connecté | Rejoindre un groupe public |
| POST | `/groups/:id/members` | admin | Ajouter des membres `{ "users": ["id", ...] }` |
| DELETE | `/groups/:id/members/:userId` | admin ou soi-même | Retirer un membre / quitter |
| POST | `/groups/:id/administrators` | admin | Promouvoir un membre `{ "user": "id" }` |
| DELETE | `/groups/:id/administrators/:userId` | admin | Retirer le rôle admin |
| GET | `/groups/:id/thread` | membre | Fil de discussion du groupe |

```json
// POST /groups
{ "name": "Les randonneurs", "description": "...", "icon": "https://img.com/i.png",
  "cover_photo": "https://img.com/c.jpg", "type": "private",
  "allow_members_to_post": true, "allow_members_to_create_events": false,
  "administrators": ["<userId>"], "members": ["<userId>", "<userId>"] }
```

### Événements 🔒

| Méthode | Route | Qui | Description |
|---|---|---|---|
| POST | `/events` | connecté (membre autorisé si `group`) | Créer un événement |
| GET | `/events?q=&from=&to=&group=&mine=true` | connecté | Lister les événements visibles |
| GET | `/events/:id` | visible | Détail |
| PATCH | `/events/:id` | organisateur | Modifier |
| DELETE | `/events/:id` | organisateur | Supprimer (+ tout ce qui en dépend) |
| POST | `/events/:id/join` | connecté | Participer à un événement public |
| POST | `/events/:id/participants` | organisateur | Inviter `{ "users": [...] }` |
| POST | `/events/:id/invite-group` | organisateur | Inviter tous les membres du groupe en 1 clic |
| DELETE | `/events/:id/participants/:userId` | organisateur ou soi-même | Retirer / se désinscrire |
| POST | `/events/:id/organizers` | organisateur | Ajouter un organisateur `{ "user": "id" }` |
| DELETE | `/events/:id/organizers/:userId` | organisateur | Retirer un organisateur |
| GET | `/events/:id/share` | organisateur | Liens de partage (Facebook, X, LinkedIn, WhatsApp) |
| GET | `/events/:id/thread` | participant | Fil de discussion de l'événement |

```json
// POST /events
{ "name": "Festival de Lyon", "description": "Concerts en plein air", "location": "Parc de la Tête d'Or, Lyon",
  "start_date": "2027-07-01T14:00:00Z", "end_date": "2027-07-02T02:00:00Z",
  "cover_photo": "https://img.com/cover.jpg", "is_private": false,
  "organizers": ["<userId>"], "participants": ["<userId>"],
  "group": "<groupId (optionnel)>", "invite_group_members": true,
  "ticketing_enabled": true, "shopping_list_enabled": true, "carpooling_enabled": true }
```

### Fils de discussion 🔒

| Méthode | Route | Description |
|---|---|---|
| GET | `/threads/:id/messages` | Messages du fil (paginé) |
| POST | `/threads/:id/messages` | Écrire `{ "content": "..." }` ou répondre `{ "content": "...", "parent_message": "<messageId>" }` |
| GET | `/threads/:id/messages/:messageId/replies` | Réponses à un message |
| DELETE | `/threads/:id/messages/:messageId` | Supprimer (auteur, admin du groupe ou organisateur) |

### Albums, photos, commentaires 🔒 (participants de l'événement)

| Méthode | Route | Description |
|---|---|---|
| POST | `/events/:id/albums` | Créer un album `{ "title", "description" }` |
| GET | `/events/:id/albums` | Albums de l'événement |
| GET / PATCH / DELETE | `/albums/:id` | Détail / modifier / supprimer (créateur ou organisateur) |
| POST | `/albums/:id/photos` | Poster une photo `{ "url": "https://...", "caption": "..." }` |
| GET | `/albums/:id/photos` | Photos de l'album (paginé) |
| GET / DELETE | `/photos/:id` | Détail / supprimer (auteur ou organisateur) |
| POST | `/photos/:id/comments` | Commenter `{ "content": "..." }` |
| GET | `/photos/:id/comments` | Commentaires |
| DELETE | `/photos/:id/comments/:commentId` | Supprimer (auteur ou organisateur) |

### Sondages 🔒

| Méthode | Route | Qui | Description |
|---|---|---|---|
| POST | `/events/:id/polls` | organisateur | Créer un sondage |
| GET | `/events/:id/polls` | participant | Lister |
| GET | `/polls/:id` | participant | Détail + ma réponse |
| DELETE | `/polls/:id` | organisateur | Supprimer |
| POST | `/polls/:id/answers` | participant | Répondre (1 fois) |
| GET | `/polls/:id/results` | participant | Résultats (votes par réponse) |

```json
// POST /events/:id/polls
{ "title": "Organisation", "questions": [
    { "label": "Que mange-t-on ?", "options": ["Pizza", "Sushi", "Burger"] },
    { "label": "À quelle heure ?", "options": ["18h", "20h"] } ] }

// POST /polls/:id/answers  (ids récupérés dans le sondage)
{ "answers": [ { "question": "<questionId>", "option": "<optionId>" },
               { "question": "<questionId>", "option": "<optionId>" } ] }
```

### Billetterie

| Méthode | Route | Qui | Description |
|---|---|---|---|
| POST | `/events/:id/ticket-types` 🔒 | organisateur | Créer un type `{ "name": "VIP", "price": 50, "quantity": 100 }` |
| GET | `/events/:id/ticket-types` | **tout le monde** | Types de billets et places restantes (`remaining`) |
| PATCH | `/ticket-types/:id` 🔒 | organisateur | Modifier |
| DELETE | `/ticket-types/:id` 🔒 | organisateur | Supprimer (si aucun billet vendu) |
| POST | `/events/:id/tickets` | **tout le monde** | Acheter un billet (sans compte) |
| GET | `/events/:id/tickets` 🔒 | organisateur | Billets vendus |

```json
// POST /events/:id/tickets
{ "ticket_type": "<ticketTypeId>",
  "buyer": { "firstname": "Jean", "lastname": "Dupont", "email": "jean@mail.com",
             "address": { "street": "1 rue de la Paix", "zip_code": "75001", "city": "Paris", "country": "France" } } }
```

La date d'achat (`purchased_at`) est ajoutée automatiquement.

### Bonus : shopping list 🔒 (participants, si `shopping_list_enabled`)

| Méthode | Route | Description |
|---|---|---|
| POST | `/events/:id/shopping-items` | `{ "name": "Chips", "quantity": 3, "arrival_time": "18:30" }` |
| GET | `/events/:id/shopping-items` | Liste |
| PATCH / DELETE | `/shopping-items/:id` | Modifier / supprimer (auteur ou organisateur) |

### Bonus : covoiturage 🔒 (participants, si `carpooling_enabled`)

| Méthode | Route | Description |
|---|---|---|
| POST | `/events/:id/carpools` | Proposer un trajet |
| GET | `/events/:id/carpools` | Trajets (avec `seats_left`) |
| PATCH / DELETE | `/carpools/:id` | Modifier / supprimer (conducteur) |
| POST | `/carpools/:id/passengers` | Réserver une place |
| DELETE | `/carpools/:id/passengers` | Annuler ma place |

```json
// POST /events/:id/carpools
{ "departure_location": "Gare de Grenoble", "departure_time": "2027-07-01T11:00:00Z",
  "price": 10, "seats_available": 3, "max_detour_minutes": 30 }
```

---

## 6. Sécurité

- Mots de passe hachés avec **bcrypt**, jamais renvoyés.
- Authentification **JWT** (expiration configurable).
- **Helmet** (en-têtes HTTP de sécurité) et **CORS**.
- **Rate limiting** sur l'inscription, la connexion et l'achat de billets.
- **Validators** Mongoose + `validator` (email, URL, noms, heures, montants, dates…) et liste blanche des champs acceptés (`pick`) pour éviter qu'un utilisateur modifie un champ interdit (ex : se rajouter organisateur).
- Secrets dans `.env` (non versionné).
