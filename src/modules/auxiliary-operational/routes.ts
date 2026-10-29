import * as h2 from './handlers/documents/[id]/file';
import * as h3 from './handlers/documents/[id]';
import * as h4 from './handlers/documents';
import * as h5 from './handlers/flights/[id]/image';
import * as h6 from './handlers/flights/[id]/pdf';
import * as h7 from './handlers/flights/[id]';
import * as h8 from './handlers/flights';
import * as h9 from './handlers/hotels';
import * as h10 from './handlers/index';
import * as h11 from './handlers/passwords';
import * as h12 from './handlers/quick-replies';
import * as h13 from './handlers/transfer-requests';
import * as h14 from './handlers/transfers/[id]/image';
import * as h15 from './handlers/transfers/[id]/pdf';
import * as h16 from './handlers/transfers/[id]';
import * as h17 from './handlers/transfers';
import * as h18 from './handlers/vouchers/[id]/pdf';
import * as h19 from './handlers/vouchers/[id]';
import * as h20 from './handlers/vouchers';
type Handler = (
  request: Request,
  context: { params: Promise<{ id?: string }> },
) => Promise<Response>;
export const routes = [
  {
    pattern: new RegExp('^documents/([0-9a-fA-F-]{36})/file$'),
    handlers: h2 as Record<string, Handler>,
  },
  {
    pattern: new RegExp('^documents/([0-9a-fA-F-]{36})$'),
    handlers: h3 as Record<string, Handler>,
  },
  {
    pattern: new RegExp('^documents$'),
    handlers: h4 as Record<string, Handler>,
  },
  {
    pattern: new RegExp('^flights/([0-9a-fA-F-]{36})/image$'),
    handlers: h5 as Record<string, Handler>,
  },
  {
    pattern: new RegExp('^flights/([0-9a-fA-F-]{36})/pdf$'),
    handlers: h6 as Record<string, Handler>,
  },
  {
    pattern: new RegExp('^flights/([0-9a-fA-F-]{36})$'),
    handlers: h7 as Record<string, Handler>,
  },
  { pattern: new RegExp('^flights$'), handlers: h8 as Record<string, Handler> },
  { pattern: new RegExp('^hotels$'), handlers: h9 as Record<string, Handler> },
  { pattern: new RegExp('^$'), handlers: h10 as Record<string, Handler> },
  {
    pattern: new RegExp('^passwords$'),
    handlers: h11 as Record<string, Handler>,
  },
  {
    pattern: new RegExp('^quick-replies$'),
    handlers: h12 as Record<string, Handler>,
  },
  {
    pattern: new RegExp('^transfer-requests$'),
    handlers: h13 as Record<string, Handler>,
  },
  {
    pattern: new RegExp('^transfers/([0-9a-fA-F-]{36})/image$'),
    handlers: h14 as Record<string, Handler>,
  },
  {
    pattern: new RegExp('^transfers/([0-9a-fA-F-]{36})/pdf$'),
    handlers: h15 as Record<string, Handler>,
  },
  {
    pattern: new RegExp('^transfers/([0-9a-fA-F-]{36})$'),
    handlers: h16 as Record<string, Handler>,
  },
  {
    pattern: new RegExp('^transfers$'),
    handlers: h17 as Record<string, Handler>,
  },
  {
    pattern: new RegExp('^vouchers/([0-9a-fA-F-]{36})/pdf$'),
    handlers: h18 as Record<string, Handler>,
  },
  {
    pattern: new RegExp('^vouchers/([0-9a-fA-F-]{36})$'),
    handlers: h19 as Record<string, Handler>,
  },
  {
    pattern: new RegExp('^vouchers$'),
    handlers: h20 as Record<string, Handler>,
  },
];
