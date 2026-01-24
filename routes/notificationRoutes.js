const express = require('express');

function initNotificationRoutes(dependencies) {
    const router = express.Router();
    const { db, authenticateToken, notificationService } = dependencies;

    // ============ RECIPIENTS ============
    router.get('/recipients', authenticateToken, async (req, res) => {
        try {
            const recipients = await db.query('SELECT * FROM notification_recipients ORDER BY created_at DESC');
            res.json(recipients);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/recipients', authenticateToken, async (req, res) => {
        try {
            const { name, email, phone, notify_email, notify_sms, sms_critical_only, telegram_chat_id, notify_telegram } = req.body;
            const sql = `INSERT INTO notification_recipients (name, email, phone, notify_email, notify_sms, sms_critical_only, telegram_chat_id, notify_telegram) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            const result = await db.run(sql, [name, email, phone, notify_email ? 1 : 0, notify_sms ? 1 : 0, sms_critical_only ? 1 : 0, telegram_chat_id, notify_telegram ? 1 : 0]);
            res.json({ success: true, id: result.lastInsertRowid });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/recipients/:id', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const { name, email, phone, enabled, notify_email, notify_sms, sms_critical_only, telegram_chat_id, notify_telegram } = req.body;
            const sql = `UPDATE notification_recipients SET name = ?, email = ?, phone = ?, enabled = ?, notify_email = ?, notify_sms = ?, sms_critical_only = ?, telegram_chat_id = ?, notify_telegram = ? WHERE id = ?`;
            await db.run(sql, [name, email, phone, enabled ? 1 : 0, notify_email ? 1 : 0, notify_sms ? 1 : 0, sms_critical_only ? 1 : 0, telegram_chat_id, notify_telegram ? 1 : 0, id]);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/recipients/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM notification_recipients WHERE id = ?', [req.params.id]);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============ CONFIG ============
    router.get('/config', authenticateToken, async (req, res) => {
        try {
            const config = await db.get('SELECT * FROM notification_config WHERE id = 1');
            if (config) {
                res.json({ ...config, gmail_app_password: '***', twilio_auth_token: '***', telegram_bot_token: '***' });
            } else res.json({ email_enabled: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/config', authenticateToken, async (req, res) => {
        try {
            const { email_enabled, sms_enabled, gmail_user, gmail_app_password, twilio_account_sid, twilio_auth_token, twilio_phone_number, telegram_bot_token } = req.body;
            const sql = `UPDATE notification_config SET email_enabled = ?, sms_enabled = ?, gmail_user = ?, gmail_app_password = ?, twilio_account_sid = ?, twilio_auth_token = ?, twilio_phone_number = ?, telegram_bot_token = ? WHERE id = 1`;
            await db.run(sql, [email_enabled ? 1 : 0, sms_enabled ? 1 : 0, gmail_user, gmail_app_password, twilio_account_sid, twilio_auth_token, twilio_phone_number, telegram_bot_token]);
            await notificationService.refreshConfig();
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ============ TEST & LOGS ============
    router.post('/test', authenticateToken, async (req, res) => {
        try {
            const { recipient_id, type } = req.body;
            const recipient = await db.get('SELECT * FROM notification_recipients WHERE id = ?', [recipient_id]);
            if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

            const testAlarm = { elementId: 'TEST', type: 'ALARM', location: 'TEST', description: 'Prueba de notificaciones', started_at: new Date().toISOString() };
            const results = [];
            if (type === 'email' || type === 'both') results.push({ type: 'email', ...(await notificationService.sendEmail(recipient, testAlarm)) });
            if (type === 'sms' || type === 'both') results.push({ type: 'sms', ...(await notificationService.sendSMS(recipient, testAlarm)) });
            if (type === 'telegram' || type === 'both') results.push({ type: 'telegram', ...(await notificationService.sendTelegram(recipient, testAlarm)) });

            res.json({ success: results.every(r => r.success), results });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.get('/logs', authenticateToken, async (req, res) => {
        try {
            const { limit = 100 } = req.query;
            const logs = await db.query('SELECT l.*, r.name as recipient_name FROM notification_log l LEFT JOIN notification_recipients r ON l.recipient_id = r.id ORDER BY l.sent_at DESC LIMIT ?', [parseInt(limit)]);
            res.json(logs);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}

module.exports = initNotificationRoutes;
