import { interpolate, shouldSend } from '../notification-template.service';

describe('notification template helpers', () => {
  it('interpolates placeholders and drops missing ones', () => {
    expect(
      interpolate('{{service}} with {{counterpartyName}} is starting now.', {
        service: 'Fade',
        counterpartyName: 'Alex',
      })
    ).toBe('Fade with Alex is starting now.');
    expect(interpolate('Your {{operatorType}} application was accepted. Welcome to OnCuts', {
      operatorType: 'Beauty',
    })).toBe('Your Beauty application was accepted. Welcome to OnCuts');
    expect(interpolate('Hello {{missing}}', {})).toBe('Hello ');
  });

  it('gates audience to consumer, operator, or both', () => {
    expect(shouldSend('both', 'consumer')).toBe(true);
    expect(shouldSend('both', 'operator')).toBe(true);
    expect(shouldSend('consumer', 'consumer')).toBe(true);
    expect(shouldSend('consumer', 'operator')).toBe(false);
    expect(shouldSend('operator', 'operator')).toBe(true);
    expect(shouldSend('operator', 'consumer')).toBe(false);
  });
});
