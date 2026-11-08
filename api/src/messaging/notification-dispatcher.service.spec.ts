import { NotificationDispatcherService } from './notification-dispatcher.service';

describe('Suppressed email dispatch', () => {
  it('does not render, send, or write misleading delivery logs', async () => {
    const db: any = { messageLog: { create: jest.fn() } };
    const templates: any = { render: jest.fn() };
    const email: any = { isAvailable: () => false, send: jest.fn() };
    const dispatcher = new NotificationDispatcherService(db, templates, {} as any, email);
    await dispatcher.dispatch({ channel: 'EMAIL' } as any);
    expect(templates.render).not.toHaveBeenCalled();
    expect(db.messageLog.create).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });
});
