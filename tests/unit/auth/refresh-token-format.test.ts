import { describe, expect, it } from 'vitest';
import { parseCompositeRefreshToken } from '../../../src/api/auth/refresh-token.util';

describe('parseCompositeRefreshToken', () => {
  it('extracts full refresh JWT and opaque secret using last delimiter', () => {
    const compositeToken =
      'header.payload.signature.0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    expect(parseCompositeRefreshToken(compositeToken)).toEqual({
      jwtPart: 'header.payload.signature',
      opaquePart: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    });
  });

  it('returns null for invalid composite token format', () => {
    expect(parseCompositeRefreshToken('not-a-composite-token')).toBeNull();
  });
});
