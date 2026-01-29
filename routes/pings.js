const express = require('express');
const router = express.Router();

module.exports = (pool, upload, authenticateToken, sharp) => {

    // Get All Active Pings (The "Feed")
    router.get('/pings', async (req, res, next) => {
        try {
            const query = `
                SELECT p.id, p.user_id, p.content, p.category, p.location_name, p.upvotes, p.created_at, 
                       u.username,
                       TO_BASE64(p.image_data) as image_base64,
                       (SELECT COUNT(*) FROM ping_votes WHERE ping_id = p.id AND vote_type = 1) as vote_count,
                       (SELECT COUNT(*) FROM comments WHERE ping_id = p.id) as comment_count
                FROM pings p
                JOIN users u ON p.user_id = u.id
                WHERE p.is_active = TRUE
                ORDER BY p.created_at DESC
                LIMIT 50
            `;
            const [rows] = await pool.query(query);
            res.json(rows);
        } catch (err) {
            next(err);
        }
    });

    // Create a New Ping (With Image Upload & Compression)
    router.post('/pings', authenticateToken, upload.single('image'), async (req, res, next) => {
        const { content, category, location_name } = req.body;
        let imageBuffer = null;

        if (!content) return res.status(400).json({ message: 'Content is required' });

        try {
            // Compress Image if Exists
            if (req.file) {
                imageBuffer = await sharp(req.file.buffer)
                    .resize({ width: 800, withoutEnlargement: true }) // Resize to max width 800px
                    .jpeg({ quality: 80 }) // Convert to JPEG with 80% quality
                    .toBuffer();
            }

            const [result] = await pool.execute(
                `INSERT INTO pings (user_id, content, category, location_name, image_data) 
                 VALUES (?, ?, ?, ?, ?)`,
                [req.user.id, content, category || 'Other', location_name, imageBuffer]
            );

            res.status(201).json({
                message: 'Ping created!',
                pingId: result.insertId
            });
        } catch (err) {
            next(err);
        }
    });

    // Edit a Ping
    router.put('/pings/:id', authenticateToken, upload.single('image'), async (req, res, next) => {
        const pingId = req.params.id;
        const { content, category, location_name } = req.body;
        let imageBuffer = null;

        if (!content) return res.status(400).json({ message: 'Content is required' });

        try {
            // Check if ping exists and verify ownership
            const [ping] = await pool.query('SELECT user_id FROM pings WHERE id = ?', [pingId]);

            if (ping.length === 0) return res.status(404).json({ message: 'Ping not found' });

            if (req.user.role !== 'admin' && ping[0].user_id !== req.user.id) {
                return res.status(403).json({ message: 'Unauthorized' });
            }

            // If a new image is uploaded, process it
            if (req.file) {
                imageBuffer = await sharp(req.file.buffer)
                    .resize({ width: 800, withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer();

                // Update with new image
                await pool.execute(
                    'UPDATE pings SET content = ?, category = ?, location_name = ?, image_data = ? WHERE id = ?',
                    [content, category || 'Other', location_name, imageBuffer, pingId]
                );
            } else {
                // Update without changing the image
                await pool.execute(
                    'UPDATE pings SET content = ?, category = ?, location_name = ? WHERE id = ?',
                    [content, category || 'Other', location_name, pingId]
                );
            }

            res.json({ message: 'Ping updated successfully' });
        } catch (err) {
            next(err);
        }
    });

    // Vote on a Ping (Upvote)
    router.post('/pings/:id/vote', authenticateToken, async (req, res, next) => {
        const pingId = req.params.id;
        const userId = req.user.id;

        try {
            // Check if already voted
            const [existing] = await pool.query(
                'SELECT id FROM ping_votes WHERE user_id = ? AND ping_id = ?',
                [userId, pingId]
            );

            if (existing.length > 0) {
                // Optional: Toggle vote (remove it)
                await pool.execute('DELETE FROM ping_votes WHERE user_id = ? AND ping_id = ?', [userId, pingId]);
                await pool.execute('UPDATE pings SET upvotes = upvotes - 1 WHERE id = ?', [pingId]);
                return res.json({ message: 'Vote removed', voted: false });
            }

            // Add vote
            await pool.execute(
                'INSERT INTO ping_votes (user_id, ping_id, vote_type) VALUES (?, ?, 1)',
                [userId, pingId]
            );
            await pool.execute('UPDATE pings SET upvotes = upvotes + 1 WHERE id = ?', [pingId]);

            res.json({ message: 'Upvoted!', voted: true });
        } catch (err) {
            next(err);
        }
    });

    // Delete a Ping (Author or Admin)
    router.delete('/pings/:id', authenticateToken, async (req, res, next) => {
        const pingId = req.params.id;

        try {
            const [ping] = await pool.query('SELECT user_id FROM pings WHERE id = ?', [pingId]);

            if (ping.length === 0) return res.status(404).json({ message: 'Ping not found' });

            if (req.user.role !== 'admin' && ping[0].user_id !== req.user.id) {
                return res.status(403).json({ message: 'Unauthorized' });
            }

            await pool.execute('DELETE FROM pings WHERE id = ?', [pingId]);
            res.json({ message: 'Ping deleted' });
        } catch (err) {
            next(err);
        }
    });

    return router;
};
