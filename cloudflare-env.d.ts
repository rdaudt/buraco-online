declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
declare namespace Cloudflare {
  interface Env {
    REALTIME_SFU_APP_ID?: string;
    REALTIME_SFU_APP_SECRET?: string;
    REALTIME_TURN_KEY_ID?: string;
    REALTIME_TURN_API_TOKEN?: string;
  }
}
