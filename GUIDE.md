# Guide pas à pas : faire tourner et comprendre le TP « My Social Networks API »

Ce guide part de zéro. Suis les étapes dans l'ordre.

---

## Étape 0 : comprendre ce qu'on construit

Une **API REST** est un programme qui tourne sur un serveur et répond à des **requêtes HTTP** en renvoyant du **JSON**. Il n'y a pas d'interface graphique : on la teste avec un outil comme **Postman**.

Exemple : on envoie `POST http://localhost:3000/events` avec un JSON décrivant un événement, et l'API l'enregistre dans la base puis renvoie l'événement créé.

Les outils du TP :

| Outil | Rôle |
|---|---|
| **Node.js** | exécute du JavaScript sur ton ordinateur (côté serveur) |
| **npm** | installe les bibliothèques (fourni avec Node.js) |
| **Express** | bibliothèque pour créer les routes (`GET /events`, `POST /groups`, …) |
| **MongoDB** | la base de données (stocke des « documents » JSON dans des « collections ») |
| **Mongoose** | bibliothèque pour décrire la forme des données (schémas) et valider ce qui entre |
| **JWT** | « jeton » que reçoit l'utilisateur après connexion, à renvoyer à chaque requête |
| **Postman** | logiciel pour envoyer des requêtes à l'API et voir les réponses |
| **Git / GitHub** | sauvegarder le code et le rendre au prof (lien du repo) |

---

## Étape 1 : installer les logiciels

1. **Node.js** (version LTS, 20 ou 22) : https://nodejs.org → bouton « LTS » → installe avec les options par défaut.
   Vérifie dans un terminal :
   ```bash
   node -v
   npm -v
   ```
   (Sur Windows, ouvre « Invite de commandes » ou « PowerShell » ; sur Mac, « Terminal ».)

2. **Visual Studio Code** (éditeur de code) : https://code.visualstudio.com

3. **Git** : https://git-scm.com/downloads → installe avec les options par défaut. Vérifie : `git --version`.
   Puis configure ton nom (une seule fois) :
   ```bash
   git config --global user.name "Ton Nom"
   git config --global user.email "ton.email@exemple.com"
   ```

4. **Postman** : https://www.postman.com/downloads (ou l'extension « Thunder Client » dans VS Code).

5. **MongoDB** : choisis UNE des deux options.

   **Option A : MongoDB Atlas (en ligne, gratuit, c'est ce que vous utilisiez en cours)**
   1. Crée un compte sur https://www.mongodb.com/cloud/atlas/register
   2. Crée un cluster gratuit (M0).
   3. *Database Access* → crée un utilisateur avec un mot de passe (note-les).
   4. *Network Access* → *Add IP Address* → *Allow access from anywhere* (0.0.0.0/0) pour le TP.
   5. *Connect* → *Drivers* → copie l'adresse `mongodb+srv://...`. Remplace `<password>` par ton mot de passe et ajoute le nom de la base avant le `?` :
      `mongodb+srv://moi:monMdp@cluster0.xxxxx.mongodb.net/my_social_networks?retryWrites=true&w=majority`

   **Option B : MongoDB installé sur ton PC**
   1. Télécharge « MongoDB Community Server » : https://www.mongodb.com/try/download/community → installe (coche « Install MongoDB as a Service » et « MongoDB Compass »).
   2. L'adresse sera : `mongodb://127.0.0.1:27017/my_social_networks`

   **MongoDB Compass** (interface graphique) te permet de voir le contenu de la base : colle la même adresse pour te connecter.

> ⚠️ Le code de ton camarade contenait **son** adresse MongoDB Atlas avec **son mot de passe** écrit dans `config/config.mjs`. Ne l'utilise pas : crée ta propre base. Dans ce projet, les secrets sont dans un fichier `.env` qui n'est jamais envoyé sur GitHub.

---

## Étape 2 : ouvrir le projet

1. Dézippe `my-social-networks-api.zip` (par exemple dans `Documents/`).
2. Dans VS Code : *Fichier → Ouvrir le dossier* → choisis `my-social-networks-api`.
3. Ouvre un terminal dans VS Code : *Terminal → Nouveau terminal*.
4. Installe les bibliothèques :
   ```bash
   npm install
   ```
   Cela crée le dossier `node_modules` (ne jamais le mettre sur GitHub, il est ignoré grâce à `.gitignore`).

---

## Étape 3 : créer le fichier `.env`

1. Copie `.env.example` et renomme la copie en `.env` (dans VS Code : clic droit → Copier, Coller, Renommer).
2. Remplis :
   - `MONGODB_URI=` ton adresse de l'étape 1 (Atlas ou locale)
   - `JWT_SECRET=` une longue phrase aléatoire, par exemple `jeSuisUnSecretTresLong_2026_xYz!`

---

## Étape 4 : lancer l'API

```bash
npm run dev
```

Tu dois voir :
```
[OK] MongoDB connecté
[OK] API lancée sur http://localhost:3000
```

Ouvre http://localhost:3000 dans ton navigateur : tu vois `{"name":"My Social Networks API",...}`.

Pour arrêter : `Ctrl + C` dans le terminal.

**Erreurs fréquentes :**
- `JWT_SECRET manquant` → le fichier `.env` n'existe pas ou est mal nommé (pas `.env.txt` !).
- `MongoServerSelectionError` / `bad auth` → mauvaise adresse ou mauvais mot de passe Atlas, ou ton IP n'est pas autorisée (Network Access).
- `EADDRINUSE` → l'API tourne déjà dans un autre terminal ; ferme-le ou change `PORT`.

---

## Étape 5 : vérifier que tout marche (test automatique)

Laisse l'API tourner, ouvre un **deuxième** terminal (bouton `+`) et lance :
```bash
npm run test:e2e
```
Le script crée des utilisateurs, groupes, événements, etc. et affiche `OK` ou `ECHEC` pour chaque cas. À la fin : `Tous les tests sont OK`.

---

## Étape 6 : tester à la main avec Postman

1. **Créer un compte** : `POST http://localhost:3000/auth/register`
   Onglet *Body* → *raw* → *JSON* :
   ```json
   { "firstname": "Alice", "lastname": "Martin", "email": "alice@mail.com", "password": "Password123" }
   ```
   La réponse contient un `token`. Copie-le.

2. **Utiliser le token** : dans chaque requête suivante, onglet *Authorization* → *Bearer Token* → colle le token.
   (Astuce : crée une variable `token` dans un environnement Postman.)

3. **Créer un événement** : `POST http://localhost:3000/events`
   ```json
   { "name": "Festival", "location": "Lyon", "start_date": "2027-07-01T14:00:00Z",
     "end_date": "2027-07-02T02:00:00Z", "ticketing_enabled": true }
   ```
   Copie le `_id` renvoyé.

4. Continue avec les routes du `README.md` : créer un type de billet, acheter un billet (sans token !), créer un sondage, etc.

5. Essaie aussi des erreurs volontaires (email invalide, date de fin avant le début, deuxième billet avec le même email…) pour voir les validators en action.

Tu peux regarder les données créées dans **MongoDB Compass**.

---

## Étape 7 : comprendre le code (pour pouvoir l'expliquer au prof)

Le projet garde la même organisation que celle du cours (celle de ton camarade) :

```
index.mjs                       démarre le serveur
config/config.mjs               lit le .env
src/controllers/server.mjs      connexion MongoDB + middlewares + routes
src/controllers/routes.mjs      liste des contrôleurs
src/controllers/events.mjs      une CLASSE par ressource : chaque méthode déclare une route
src/models/event.mjs            un SCHÉMA Mongoose par collection (avec les validators)
src/middlewares/auth.mjs        vérifie le token JWT
src/utils/permissions.mjs       "est-il organisateur ? membre ? admin ?"
src/utils/loaders.mjs           charge un événement/groupe ET vérifie les droits
src/utils/http.mjs              erreurs HTTP et gestion centralisée des erreurs
```

**Le chemin d'une requête** (ex : `PATCH /events/123`) :
1. `server.mjs` : helmet, cors, lecture du JSON.
2. `auth.mjs` : vérifie le token → `req.user.id`.
3. `events.mjs` → `update()` :
   - `loadEvent(..., 'organizer')` charge l'événement, renvoie 404 s'il n'existe pas (ou s'il est privé et que tu n'y es pas), 403 si tu n'es pas organisateur ;
   - `pick(req.body, FIELDS)` ne garde que les champs autorisés ;
   - `event.save()` déclenche les **validators** du schéma (dates, URL, …).
4. Si une erreur est lancée (`throw`), Express 5 l'envoie à `errorHandler` qui renvoie le bon code (400, 403, 404, 409…).

**Où sont les exigences du sujet :**

| Exigence | Où |
|---|---|
| Email unique | `models/user.mjs` (`unique: true`) + vérification dans `controllers/auth.mjs` |
| Événement : 1+ organisateurs, participants | `models/event.mjs` (`organizers` avec validator `nonEmptyArray`) |
| Groupe : 1+ admins, 1+ membres, public/privé/secret | `models/group.mjs` |
| Invitation automatique des membres du groupe | `controllers/events.mjs` → `create()` et `inviteGroup()` |
| Partage sur les réseaux (groupe public) | `controllers/events.mjs` → `share()` |
| Fil lié à 1 groupe OU 1 événement | `models/thread.mjs` (hook `pre('validate')`) |
| Répondre à un message | `models/message.mjs` (`parent_message`) |
| Album → 1 événement, photos/commentaires par participants | `models/album.mjs`, `photo.mjs`, `comment.mjs`, `controllers/albums.mjs` |
| Sondage : 1+ questions, 1 réponse par question | `models/poll.mjs`, `poll-answer.mjs`, `controllers/polls.mjs` → `answer()` |
| Billetterie : types, quantité limitée, 1 billet par personne | `models/ticket-type.mjs`, `ticket.mjs` (index unique), `controllers/tickets.mjs` → `purchase()` |
| Bonus shopping list (objet unique par événement) | `models/shopping-item.mjs` (index unique), `controllers/shopping-list.mjs` |
| Bonus covoiturage | `models/carpool.mjs`, `controllers/carpools.mjs` |
| Documentation | `README.md` |

**Ce qui a changé par rapport au code de ton camarade (à savoir expliquer) :**
- Le login acceptait n'importe quel `userId` sans mot de passe → maintenant **email + mot de passe haché (bcrypt)**.
- Les identifiants MongoDB étaient écrits dans le code → maintenant dans `.env`.
- Les modèles sont enregistrés une seule fois (`models/index.mjs`) pour que les contrôleurs puissent se référencer entre eux.
- Les erreurs sont gérées à un seul endroit (`errorHandler`) au lieu d'un `try/catch` dans chaque route.
- Mongoose 8 : l'ancien `connect.close(callback)` ne marche plus, d'où le nouveau `dbConnect()`.

---

## Étape 8 : mettre le projet sur GitHub et le rendre

1. Crée un compte sur https://github.com puis *New repository* → nom `my-social-networks-api` → **sans** README → *Create repository*.
2. Dans le terminal de VS Code (dans le dossier du projet) :
   ```bash
   git init
   git add .
   git commit -m "API My Social Networks"
   git branch -M main
   git remote add origin https://github.com/TON_PSEUDO/my-social-networks-api.git
   git push -u origin main
   ```
3. Vérifie sur GitHub que `.env` et `node_modules` **n'apparaissent pas** (ils sont exclus par `.gitignore`).
4. Envoie le lien du repo sur Teams quand le devoir est ouvert.

Bonne pratique : fais des commits au fur et à mesure si tu modifies le projet (`git add .` puis `git commit -m "message"` puis `git push`).

---

## (Optionnel) Lancer en HTTPS comme en cours

```bash
mkdir cert
openssl req -x509 -newkey rsa:2048 -nodes -keyout cert/server.key -out cert/server.crt -days 365 -subj "/CN=localhost"
```
(`openssl` est disponible dans « Git Bash » sur Windows.) Puis mets `USE_HTTPS=true` dans `.env`. Dans Postman, désactive *Settings → SSL certificate verification* (certificat auto-signé).
