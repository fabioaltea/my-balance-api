import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import { PushNotificationsHelper } from '../helpers/push-notifications.helper';

export const pushJobsRoutes = Router();
pushJobsRoutes.get('/', async (req, res) => {
  const expected = process.env.CRON_SECRET;
  const received = req.headers.authorization;
  if (
    !expected ||
    !received ||
    Buffer.byteLength(received) !== Buffer.byteLength(`Bearer ${expected}`) ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(`Bearer ${expected}`))
  ) {
    res.status(401).json({ success: false });
    return;
  }
  try {
    res.json({ success: true, ...(await PushNotificationsHelper.run(5)) });
  } catch (error) {
    console.error('Push worker failed');
    res.status(500).json({ success: false });
  }
});
