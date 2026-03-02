import axios from 'axios';

export const routingClient = axios.create({
  timeout: 4_000,
  validateStatus: () => true,
});

export const fxClient = axios.create({
  timeout: 4_000,
  validateStatus: () => true,
});
