import auth from '../middlewares/auth.mjs';
import { pick, forbidden, notFound, checkId, pagination } from '../utils/http.mjs';
import { loadEvent } from '../utils/loaders.mjs';
import { isOrganizer } from '../utils/permissions.mjs';

const Albums = class Albums {
  constructor(app, models) {
    this.app = app;
    this.models = models;
    this.Album = models.Album;
    this.Photo = models.Photo;
    this.Comment = models.Comment;

    this.run();
  }

  async loadAlbum(albumId, userId) {
    checkId(albumId, 'albumId');
    const album = await this.Album.findById(albumId);
    if (!album) throw notFound('Album');
    const event = await loadEvent(this.models, album.event, userId, 'participant');
    return { album, event };
  }

  async loadPhoto(photoId, userId) {
    checkId(photoId, 'photoId');
    const photo = await this.Photo.findById(photoId);
    if (!photo) throw notFound('Photo');
    const { album, event } = await this.loadAlbum(photo.album, userId);
    return { photo, album, event };
  }

  createAlbum() {
    this.app.post('/events/:id/albums', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'participant');
      const album = await this.Album.create({
        ...pick(req.body, ['title', 'description']),
        event: event._id,
        created_by: req.user.id
      });
      res.status(201).json(album);
    });
  }

  listAlbums() {
    this.app.get('/events/:id/albums', auth, async (req, res) => {
      const event = await loadEvent(this.models, req.params.id, req.user.id, 'participant');
      const albums = await this.Album.find({ event: event._id }).sort({ created_at: -1 });
      res.status(200).json(albums);
    });
  }

  getAlbum() {
    this.app.get('/albums/:id', auth, async (req, res) => {
      const { album } = await this.loadAlbum(req.params.id, req.user.id);
      res.status(200).json(album);
    });
  }

  updateAlbum() {
    this.app.patch('/albums/:id', auth, async (req, res) => {
      const { album, event } = await this.loadAlbum(req.params.id, req.user.id);
      if (String(album.created_by) !== req.user.id && !isOrganizer(event, req.user.id)) {
        throw forbidden("Seul le créateur de l'album ou un organisateur peut le modifier");
      }
      album.set(pick(req.body, ['title', 'description']));
      await album.save();
      res.status(200).json(album);
    });
  }

  deleteAlbum() {
    this.app.delete('/albums/:id', auth, async (req, res) => {
      const { album, event } = await this.loadAlbum(req.params.id, req.user.id);
      if (String(album.created_by) !== req.user.id && !isOrganizer(event, req.user.id)) {
        throw forbidden("Seul le créateur de l'album ou un organisateur peut le supprimer");
      }
      const photos = await this.Photo.find({ album: album._id }).select('_id');
      await this.Comment.deleteMany({ photo: { $in: photos.map((p) => p._id) } });
      await this.Photo.deleteMany({ album: album._id });
      await album.deleteOne();
      res.status(204).send();
    });
  }

  createPhoto() {
    this.app.post('/albums/:id/photos', auth, async (req, res) => {
      const { album } = await this.loadAlbum(req.params.id, req.user.id);
      const photo = await this.Photo.create({
        ...pick(req.body, ['url', 'caption']),
        album: album._id,
        author: req.user.id
      });
      res.status(201).json(photo);
    });
  }

  listPhotos() {
    this.app.get('/albums/:id/photos', auth, async (req, res) => {
      const { album } = await this.loadAlbum(req.params.id, req.user.id);
      const { limit, skip, page } = pagination(req.query);
      const [photos, total] = await Promise.all([
        this.Photo.find({ album: album._id }).populate('author', 'firstname lastname avatar')
          .sort({ created_at: -1 }).skip(skip).limit(limit),
        this.Photo.countDocuments({ album: album._id })
      ]);
      res.status(200).json({ page, limit, total, data: photos });
    });
  }

  getPhoto() {
    this.app.get('/photos/:id', auth, async (req, res) => {
      const { photo } = await this.loadPhoto(req.params.id, req.user.id);
      await photo.populate('author', 'firstname lastname avatar');
      res.status(200).json(photo);
    });
  }

  deletePhoto() {
    this.app.delete('/photos/:id', auth, async (req, res) => {
      const { photo, event } = await this.loadPhoto(req.params.id, req.user.id);
      if (String(photo.author) !== req.user.id && !isOrganizer(event, req.user.id)) {
        throw forbidden("Seul l'auteur de la photo ou un organisateur peut la supprimer");
      }
      await this.Comment.deleteMany({ photo: photo._id });
      await photo.deleteOne();
      res.status(204).send();
    });
  }

  createComment() {
    this.app.post('/photos/:id/comments', auth, async (req, res) => {
      const { photo } = await this.loadPhoto(req.params.id, req.user.id);
      const comment = await this.Comment.create({
        photo: photo._id,
        author: req.user.id,
        content: req.body.content
      });
      res.status(201).json(comment);
    });
  }

  listComments() {
    this.app.get('/photos/:id/comments', auth, async (req, res) => {
      const { photo } = await this.loadPhoto(req.params.id, req.user.id);
      const comments = await this.Comment.find({ photo: photo._id })
        .populate('author', 'firstname lastname avatar').sort({ created_at: 1 });
      res.status(200).json(comments);
    });
  }

  deleteComment() {
    this.app.delete('/photos/:id/comments/:commentId', auth, async (req, res) => {
      const { photo, event } = await this.loadPhoto(req.params.id, req.user.id);
      checkId(req.params.commentId, 'commentId');
      const comment = await this.Comment.findOne({ _id: req.params.commentId, photo: photo._id });
      if (!comment) throw notFound('Comment');
      if (String(comment.author) !== req.user.id && !isOrganizer(event, req.user.id)) {
        throw forbidden('Vous ne pouvez supprimer que vos propres commentaires');
      }
      await comment.deleteOne();
      res.status(204).send();
    });
  }

  run() {
    this.createAlbum();
    this.listAlbums();
    this.getAlbum();
    this.updateAlbum();
    this.deleteAlbum();
    this.createPhoto();
    this.listPhotos();
    this.getPhoto();
    this.deletePhoto();
    this.createComment();
    this.listComments();
    this.deleteComment();
  }
};

export default Albums;
