import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

export const POST = async (req: Request) => {
  // Check if Redis is configured
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return NextResponse.json({ success: false, message: 'Redis not configured' });
  }

  try {
    const redis = Redis.fromEnv();
    
    // Count views per page
    const key = `views`;
    await redis.incr(key);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Redis error:', error);
    return NextResponse.json({ success: false, message: 'Redis error' });
  }
};
