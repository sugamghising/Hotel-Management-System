export interface ParsedRefreshToken {
  jwtPart: string;
  opaquePart: string;
}

export const parseCompositeRefreshToken = (token: string): ParsedRefreshToken | null => {
  const delimiterIndex = token.lastIndexOf('.');
  if (delimiterIndex <= 0 || delimiterIndex === token.length - 1) {
    return null;
  }

  return {
    jwtPart: token.slice(0, delimiterIndex),
    opaquePart: token.slice(delimiterIndex + 1),
  };
};
