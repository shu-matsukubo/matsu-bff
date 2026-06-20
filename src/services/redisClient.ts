import net from 'node:net';
import { config } from '../config.js';

const redisUrl = new URL(config.redisUrl);

const encodeCommand = (parts: Array<string | number>): string =>
  `*${parts.length}\r\n${parts
    .map((part) => {
      const value = String(part);
      return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
    })
    .join('')}`;

const parseResponse = (buffer: Buffer): string | number | null => {
  const text = buffer.toString('utf8');
  const type = text[0];

  if (type === '+') {
    return text.slice(1, text.indexOf('\r\n'));
  }

  if (type === ':') {
    return Number.parseInt(text.slice(1, text.indexOf('\r\n')), 10);
  }

  if (type === '$') {
    const headerEnd = text.indexOf('\r\n');
    const length = Number.parseInt(text.slice(1, headerEnd), 10);

    if (length === -1) {
      return null;
    }

    const start = headerEnd + 2;
    return text.slice(start, start + length);
  }

  if (type === '-') {
    throw new Error(text.slice(1, text.indexOf('\r\n')));
  }

  throw new Error('Unsupported Redis response.');
};

const command = (parts: Array<string | number>): Promise<string | number | null> =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: redisUrl.hostname,
      port: Number(redisUrl.port || 6379),
    });

    const chunks: Buffer[] = [];

    socket.setTimeout(5000);

    socket.on('connect', () => {
      socket.write(encodeCommand(parts));
    });

    socket.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      socket.end();
    });

    socket.on('end', () => {
      try {
        resolve(parseResponse(Buffer.concat(chunks)));
      } catch (error) {
        reject(error);
      }
    });

    socket.on('timeout', () => {
      socket.destroy(new Error('Redis command timed out.'));
    });

    socket.on('error', reject);
  });

export const redis = {
  get: (key: string) => command(['GET', key]),
  setJson: (key: string, value: unknown, ttlSeconds: number) =>
    command(['SET', key, JSON.stringify(value), 'EX', ttlSeconds]),
  del: (key: string) => command(['DEL', key]),
};
