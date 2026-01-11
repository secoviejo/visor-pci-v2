const nodemailer = require('nodemailer');
const twilio = require('twilio');
const db = require('../database');
const fs = require('fs');
const path = require('path');

class NotificationService {
    constructor() {
        this.emailTransporter = null;
        this.twilioClient = null;
        this.emailTemplate = null;
        this.initializeServices();
        this.loadEmailTemplate();
    }

    initializeServices() {
        try {
            // Get config from database
            const config = db.prepare('SELECT * FROM notification_config WHERE id = 1').get();

            if (!config) {
                console.log('[Notifications] No configuration found');
                return;
            }

            // Initialize Nodemailer (Gmail)
            if (config.gmail_user && config.gmail_app_password) {
                this.emailTransporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: config.gmail_user,
                        pass: config.gmail_app_password
                    }
                });
                console.log('[Notifications] Email service initialized');
            } else if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
                // Fallback to env vars
                this.emailTransporter = nodemailer.createTransport({
                    service: process.env.EMAIL_SERVICE || 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD
                    }
                });
                console.log('[Notifications] Email service initialized from ENV');
            }

            // Initialize Twilio
            if (config.twilio_account_sid && config.twilio_auth_token) {
                this.twilioClient = twilio(config.twilio_account_sid, config.twilio_auth_token);
                this.twilioPhoneNumber = config.twilio_phone_number;
                console.log('[Notifications] SMS service initialized');
            } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
                // Fallback to env vars
                this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
                console.log('[Notifications] SMS service initialized from ENV');
            }

        } catch (error) {
            console.error('[Notifications] Initialization error:', error.message);
        }
    }

    loadEmailTemplate() {
        try {
            const templatePath = path.join(__dirname, '../templates/email/alarm.html');
            if (fs.existsSync(templatePath)) {
                this.emailTemplate = fs.readFileSync(templatePath, 'utf8');
            } else {
                // Inline fallback template
                this.emailTemplate = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <div style="background: {{PRIORITY_COLOR}}; color: white; padding: 15px; border-radius: 5px 5px 0 0;">
            <h2 style="margin: 0;">🚨 Alarma PCI Detectada</h2>
        </div>
        <div style="background: white; padding: 20px; border-radius: 0 0 5px 5px;">
            <p><strong>Prioridad:</strong> <span style="color: {{PRIORITY_COLOR}}; font-weight: bold;">{{PRIORITY}}</span></p>
            <p><strong>Edificio:</strong> {{BUILDING}}</p>
            <p><strong>Planta:</strong> {{FLOOR}}</p>
            <p><strong>Ubicación:</strong> {{LOCATION}}</p>
            <p><strong>Descripción:</strong> {{DESCRIPTION}}</p>
            <p><strong>Origen:</strong> {{ORIGIN}}</p>
            <p><strong>Timestamp:</strong> {{TIMESTAMP}}</p>
        </div>
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
            Sistema de Notificaciones PCI - Visor CIRCE
        </p>
    </div>
</body>
</html>`;
            }
        } catch (error) {
            console.error('[Notifications] Error loading template:', error.message);
        }
    }

    classifyPriority(alarm) {
        // CRITICAL: Real hardware alarms OR general building alarms
        if (alarm.origin === 'REAL' || alarm.priority === 'CRITICAL') {
            return 'CRITICAL';
        }
        // NORMAL: Simulated alarms, individual device alarms
        return 'NORMAL';
    }

    async sendEmail(recipient, alarm, alarmId) {
        if (!this.emailTransporter) {
            console.log('[Email] Service not initialized');
            return { success: false, error: 'Email service not configured' };
        }

        try {
            const priority = this.classifyPriority(alarm);
            const priorityColor = priority === 'CRITICAL' ? '#dc2626' : '#f59e0b';

            // Fetch additional data
            const building = alarm.building_id ?
                db.prepare('SELECT name FROM buildings WHERE id = ?').get(alarm.building_id) : null;
            const floor = alarm.floor_id ?
                db.prepare('SELECT name FROM floors WHERE id = ?').get(alarm.floor_id) : null;

            const html = this.emailTemplate
                .replace(/{{PRIORITY}}/g, priority)
                .replace(/{{PRIORITY_COLOR}}/g, priorityColor)
                .replace(/{{BUILDING}}/g, building?.name || alarm.building_name || 'Desconocido')
                .replace(/{{FLOOR}}/g, floor?.name || 'Desconocido')
                .replace(/{{LOCATION}}/g, alarm.location || 'No especificada')
                .replace(/{{DESCRIPTION}}/g, alarm.description || 'Alarma detectada')
                .replace(/{{ORIGIN}}/g, alarm.origin || 'N/A')
                .replace(/{{TIMESTAMP}}/g, new Date(alarm.started_at || Date.now()).toLocaleString('es-ES'));

            const info = await this.emailTransporter.sendMail({
                from: `"Sistema PCI CIRCE" <${process.env.EMAIL_USER || 'noreply@pci.com'}>`,
                to: recipient.email,
                subject: `🚨 Alarma PCI - ${priority} - ${building?.name || 'Edificio'}`,
                html: html
            });

            console.log(`[Email] Sent to ${recipient.email}: ${info.messageId}`);

            // Log to database
            db.prepare(`
                INSERT INTO notification_log (alarm_id, recipient_id, type, status)
                VALUES (?, ?, 'EMAIL', 'SENT')
            `).run(alarmId, recipient.id);

            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error(`[Email] Error sending to ${recipient.email}:`, error.message);

            // Log failure
            db.prepare(`
                INSERT INTO notification_log (alarm_id, recipient_id, type, status, error_message)
                VALUES (?, ?, 'EMAIL', 'FAILED', ?)
            `).run(alarmId, recipient.id, error.message);

            return { success: false, error: error.message };
        }
    }

    async sendSMS(recipient, alarm, alarmId) {
        if (!this.twilioClient) {
            console.log('[SMS] Service not initialized');
            return { success: false, error: 'SMS service not configured' };
        }

        try {
            const building = alarm.building_id ?
                db.prepare('SELECT name FROM buildings WHERE id = ?').get(alarm.building_id) : null;

            const floor = alarm.floor_id ?
                db.prepare('SELECT name FROM floors WHERE id = ?').get(alarm.floor_id) : null;

            const priority = this.classifyPriority(alarm);

            const buildingName = building?.name || alarm.building_name || 'Edificio Desconocido';
            const floorName = floor?.name || '';
            const location = alarm.location || 'N/A';
            const description = alarm.description || 'Alarma detectada';

            // Format:
            // 🚨 ALARMA PCI [CRITICAL]
            // 🏢 Edificio: [Nombre]
            // 📍 Ubicación: [Planta] - [Loc]
            // 📝 Desc: [Descripción]
            const message = `🚨 ALARMA PCI [${priority}]\n🏢 Edificio: ${buildingName}\n📍 Ubicación: ${floorName ? floorName + ' - ' : ''}${location}\n📝 Desc: ${description}`;

            const result = await this.twilioClient.messages.create({
                body: message,
                from: this.twilioPhoneNumber,
                to: recipient.phone
            });

            console.log(`[SMS] Sent to ${recipient.phone}: ${result.sid}`);

            // Log to database
            db.prepare(`
                INSERT INTO notification_log (alarm_id, recipient_id, type, status)
                VALUES (?, ?, 'SMS', 'SENT')
            `).run(alarmId, recipient.id);

            return { success: true, sid: result.sid };
        } catch (error) {
            console.error(`[SMS] Error sending to ${recipient.phone}:`, error.message);

            // Log failure
            db.prepare(`
                INSERT INTO notification_log (alarm_id, recipient_id, type, status, error_message)
                VALUES (?, ?, 'SMS', 'FAILED', ?)
            `).run(alarmId, recipient.id, error.message);

            return { success: false, error: error.message };
        }
    }

    async notifyAlarm(alarm) {
        try {
            // ⚠️ ONLY SEND NOTIFICATIONS FOR REAL ALARMS (not simulated)
            if (alarm.origin !== 'REAL') {
                console.log(`[Notify] Skipping notification for ${alarm.origin} alarm (only REAL alarms trigger notifications)`);
                return { success: true, message: 'Simulated alarm - notifications skipped' };
            }

            // Get system config
            const config = db.prepare('SELECT * FROM notification_config WHERE id = 1').get();
            if (!config) {
                console.log('[Notify] No configuration found');
                return { success: false, error: 'Service not configured' };
            }

            // Get active recipients
            const recipients = db.prepare('SELECT * FROM notification_recipients WHERE enabled = 1').all();
            if (recipients.length === 0) {
                console.log('[Notify] No active recipients');
                return { success: true, message: 'No recipients configured' };
            }

            const priority = this.classifyPriority(alarm);
            const isCritical = priority === 'CRITICAL';

            // We'll use alarm.db_id if available, or create a placeholder
            const alarmId = alarm.db_id || alarm.id || null;

            const results = [];

            for (const recipient of recipients) {
                // Send Email if enabled
                if (config.email_enabled && recipient.notify_email) {
                    const emailResult = await this.sendEmail(recipient, alarm, alarmId);
                    results.push({ type: 'email', recipient: recipient.email, ...emailResult });
                }

                // Send SMS if enabled and conditions met
                const shouldSendSMS = config.sms_enabled &&
                    recipient.notify_sms &&
                    (!recipient.sms_critical_only || isCritical);

                if (shouldSendSMS) {
                    const smsResult = await this.sendSMS(recipient, alarm, alarmId);
                    results.push({ type: 'sms', recipient: recipient.phone, ...smsResult });
                }
            }

            console.log(`[Notify] Processed ${results.length} notifications for alarm ${alarmId}`);
            return { success: true, results };

        } catch (error) {
            console.error('[Notify] Error:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Method to refresh configuration (when user updates settings)
    refreshConfig() {
        this.initializeServices();
        console.log('[Notifications] Configuration refreshed');
    }
}

// Singleton instance
const notificationService = new NotificationService();

module.exports = notificationService;
