import { Response, NextFunction } from 'express';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  createCustomTemplate,
  deleteCustomTemplate,
  listNotificationTemplates,
  parseAudience,
  queueCustomBroadcast,
  updateNotificationTemplate,
} from '../services/notification-template.service';

function requireAdmin(req: AuthRequest): string {
  const userRole = req.user!.role?.toUpperCase();
  if (userRole !== 'ADMIN') {
    throw new ApiError(403, 'Admin access required');
  }
  return req.user!.userId;
}

export const listTemplates = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);
    const templates = await listNotificationTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
};

export const createTemplate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = requireAdmin(req);
    const title = String(req.body?.title ?? '').trim();
    const body = String(req.body?.body ?? '').trim();
    const audience = parseAudience(req.body?.audience);
    if (!title || !body) {
      throw new ApiError(400, 'title and body are required');
    }
    if (!audience) {
      throw new ApiError(400, "audience must be 'consumer', 'operator', or 'both'");
    }
    const template = await createCustomTemplate({
      label: req.body?.label,
      title,
      body,
      audience,
      updatedBy: adminId,
    });
    logger.info('admin_create_notification_template', { adminId, id: template.id, audience });
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

export const updateTemplate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = requireAdmin(req);
    const { id } = req.params;
    const body = req.body ?? {};
    const patch: {
      label?: string;
      title?: string;
      body?: string;
      audience?: 'consumer' | 'operator' | 'both';
      enabled?: boolean;
    } = {};

    if (Object.prototype.hasOwnProperty.call(body, 'label')) {
      const label = String(body.label ?? '').trim();
      if (!label) throw new ApiError(400, 'label cannot be empty');
      patch.label = label;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      const title = String(body.title ?? '').trim();
      if (!title) throw new ApiError(400, 'title cannot be empty');
      patch.title = title;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'body')) {
      const text = String(body.body ?? '').trim();
      if (!text) throw new ApiError(400, 'body cannot be empty');
      patch.body = text;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'audience')) {
      const audience = parseAudience(body.audience);
      if (!audience) {
        throw new ApiError(400, "audience must be 'consumer', 'operator', or 'both'");
      }
      patch.audience = audience;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'enabled')) {
      patch.enabled = Boolean(body.enabled);
    }

    if (Object.keys(patch).length === 0) {
      throw new ApiError(400, 'Provide at least one of label, title, body, audience, enabled');
    }

    const template = await updateNotificationTemplate(id, patch, adminId);
    logger.info('admin_update_notification_template', { adminId, id, ...patch });
    res.json({ success: true, data: template });
  } catch (error) {
    if (error instanceof Error && error.message === 'Notification template not found') {
      next(new ApiError(404, error.message));
      return;
    }
    next(error);
  }
};

export const deleteTemplate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = requireAdmin(req);
    await deleteCustomTemplate(req.params.id);
    logger.info('admin_delete_notification_template', { adminId, id: req.params.id });
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    if (error instanceof Error && error.message === 'Custom notification not found') {
      next(new ApiError(404, error.message));
      return;
    }
    next(error);
  }
};

export const sendTemplate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = requireAdmin(req);
    const result = await queueCustomBroadcast(req.params.id);
    logger.info('admin_send_notification_template', { adminId, id: req.params.id, ...result });
    res.json({
      success: true,
      data: result,
      message: `Sending to ${result.queued} ${result.audience === 'both' ? 'users' : `${result.audience}s`}`,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === 'Notification template not found' ||
        error.message === 'Only custom notifications can be sent' ||
        error.message === 'Notification is disabled'
      ) {
        next(new ApiError(error.message === 'Notification template not found' ? 404 : 400, error.message));
        return;
      }
    }
    next(error);
  }
};
