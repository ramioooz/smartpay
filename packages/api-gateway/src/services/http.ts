import axios from 'axios';
import { config } from '../config';

export const httpClient = axios.create({
  timeout: config.GATEWAY_REQUEST_TIMEOUT_MS,
});
