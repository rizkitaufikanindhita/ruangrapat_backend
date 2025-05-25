import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import bcrypt from 'bcryptjs';
import { cors } from '$lib/server/cors';

// POST /api/users - Signup (Create new user)
export const POST: RequestHandler = cors(async ({ request }) => {
	try {
		const data = await request.json();

		// Validate required fields
		if (!data.username || !data.password) {
			return json({ error: 'Username and password are required' }, { status: 400 });
		}

		// Validate username
		if (data.username.length > 30) {
			return json({ error: 'Username must be 30 characters or less' }, { status: 400 });
		}

		// Validate password
		if (data.password.length < 4) {
			return json({ error: 'Password must be at least 4 characters long' }, { status: 400 });
		}

		// Check if username already exists
		const existingUser = await prisma.user.findFirst({
			where: { username: data.username.toLowerCase() }
		});

		if (existingUser) {
			return json({ error: 'Username already exists' }, { status: 409 });
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(data.password, 10);

		// Create user
		const user = await prisma.user.create({
			data: {
				username: data.username.toLowerCase(),
				password: hashedPassword
			}
		});

		// Remove password from response
		const { password, ...userWithoutPassword } = user;

		return json(userWithoutPassword, { status: 201 });
	} catch (error) {
		console.error('Error creating user:', error);
		return json({ error: 'Failed to create user' }, { status: 500 });
	}
});

export const OPTIONS: RequestHandler = cors(async () => {
	return new Response(null, { status: 204 });
});
