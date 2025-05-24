// middleware to check if user is authenticated

import jwt from 'jsonwebtoken';
import { error } from '@sveltejs/kit';
import { prisma } from './prisma';
import type { RequestEvent } from '@sveltejs/kit';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your-secret-key';

export async function authMiddleware(event: RequestEvent) {
	const authHeader = event.request.headers.get('authorization');

	if (!authHeader) {
		throw error(401, 'Please login to continue');
	}

	try {
		const token = authHeader.split(' ')[1];
		const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

		const user = await prisma.user.findUnique({
			where: { id: decoded.id }
		});

		if (!user) {
			throw error(401, 'User not found');
		}

		// Add user to event.locals for use in routes
		event.locals.user = user;

		return event;
	} catch (err) {
		throw error(401, 'Invalid or expired token');
	}
}

// Helper function to generate JWT token
export function generateToken(userId: string): string {
	return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '24h' });
}
