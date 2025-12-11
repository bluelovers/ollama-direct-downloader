import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

export const POST = async (req: Request) => {
  // Check if Redis is configured
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return NextResponse.json({ success: false, message: 'Redis not configured' });
  }

  try {
    const { query } = await req.json();
    const redis = Redis.fromEnv();

    // Save query to a list
    await redis.lpush('queries', query);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Redis error:', error);
    return NextResponse.json({ success: false, message: 'Redis error' });
  }
};
