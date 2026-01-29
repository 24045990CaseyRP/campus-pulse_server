const express = require('express');
const router = express.Router();

module.exports = (pool, upload, authenticateToken, sharp) => {

    // Get Comments for a Ping
    router.get('/pings/:id/comments', async (req, res, next) => {
        const pingId = req.params.id;
        try {
            const query = `
                SELECT c.id, c.content, c.created_at, u.username,
                       TO_BASE64(c.image_data) as image_base64
                FROM comments c
                JOIN users u ON c.user_id = u.id
                WHERE c.ping_id = ?
                ORDER BY c.created_at ASC
            `;
            const [rows] = await pool.query(query, [pingId]);
            res.json(rows);
        } catch (err) {
            next(err);
        }
    });

    // Add a Comment to a Ping (with optional image & Compression)
    router.post('/pings/:id/comments', authenticateToken, upload.single('image'), async (req, res, next) => {
        const pingId = req.params.id;
        const { content } = req.body;
        const userId = req.user.id;
        let imageBuffer = null;

        if (!content) return res.status(400).json({ message: 'Comment content required' });

        try {
            // Compress Image if Exists
            if (req.file) {
                imageBuffer = await sharp(req.file.buffer)
                    .resize({ width: 800, withoutEnlargement: true }) // Resize to max width 800px
                    .jpeg({ quality: 80 }) // Convert to JPEG with 80% quality
                    .toBuffer();
            }

            await pool.execute(
                'INSERT INTO comments (user_id, ping_id, content, image_data) VALUES (?, ?, ?, ?)',
                [userId, pingId, content, imageBuffer]
            );
            res.status(201).json({ message: 'Comment added' });
        } catch (err) {
            next(err);
        }
    });

    // Edit a Comment
    router.put('/comments/:id', authenticateToken, upload.single('image'), async (req, res, next) => {
        const commentId = req.params.id;
        const { content } = req.body;
        let imageBuffer = null;

        if (!content) return res.status(400).json({ message: 'Comment content required' });

        try {
            // Check if comment exists and verify ownership
            const [comment] = await pool.query('SELECT user_id FROM comments WHERE id = ?', [commentId]);

            if (comment.length === 0) return res.status(404).json({ message: 'Comment not found' });

            if (req.user.role !== 'admin' && comment[0].user_id !== req.user.id) {
                return res.status(403).json({ message: 'Unauthorized' });
            }

            // If a new image is uploaded, process it
            if (req.file) {
                imageBuffer = await sharp(req.file.buffer)
                    .resize({ width: 800, withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer();

                await pool.execute(
                    'UPDATE comments SET content = ?, image_data = ? WHERE id = ?',
                    [content, imageBuffer, commentId]
                );
            } else {
                await pool.execute(
                    'UPDATE comments SET content = ? WHERE id = ?',
                    [content, commentId]
                );
            }

            res.json({ message: 'Comment updated' });
        } catch (err) {
            next(err);
        }
    });

    // Delete a Comment
    router.delete('/comments/:id', authenticateToken, async (req, res, next) => {
        const commentId = req.params.id;

        try {
            const [comment] = await pool.query('SELECT user_id FROM comments WHERE id = ?', [commentId]);

            if (comment.length === 0) return res.status(404).json({ message: 'Comment not found' });

            if (req.user.role !== 'admin' && comment[0].user_id !== req.user.id) {
                return res.status(403).json({ message: 'Unauthorized' });
            }

            await pool.execute('DELETE FROM comments WHERE id = ?', [commentId]);
            res.json({ message: 'Comment deleted' });
        } catch (err) {
            next(err);
        }
    });

    return router;
};
