import {gateway} from '../server/gateway.js';
export const onRequest=({request,env})=>gateway(request,env);
