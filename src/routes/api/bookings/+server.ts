import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { authMiddleware } from '$lib/server/auth';
import { cors } from '$lib/server/cors';

// GET /api/bookings - Get all bookings
export const GET: RequestHandler = cors(async (event) => {
	try {
		// Apply auth middleware
		await authMiddleware(event);

		const bookings = await prisma.booking.findMany({
			include: {
				user: {
					select: {
						id: true,
						username: true,
						createdAt: true,
						updatedAt: true
					}
				}
			},
			orderBy: {
				date: 'desc'
			}
		});
		return json(bookings);
	} catch (error) {
		console.error('Error fetching bookings:', error);
		return json({ error: 'Failed to fetch bookings' }, { status: 500 });
	}
});

// POST /api/bookings - Create a new booking
export const POST: RequestHandler = cors(async (event) => {
	try {
		// Apply auth middleware
		await authMiddleware(event);
		const data = await event.request.json();

		// Use the authenticated user's ID
		const userId = event.locals.user!.id;

		// Validate required fields
		const requiredFields = [
			'date',
			'event',
			'clockStart',
			'clockEnd',
			'room',
			'pic',
			'kapasitas',
			'rapat',
			'catatan'
		];

		for (const field of requiredFields) {
			if (!data[field]) {
				return json({ error: `Missing required field: ${field}` }, { status: 400 });
			}
		}

		// Validate date
		const bookingDate = new Date(data.date);
		if (isNaN(bookingDate.getTime())) {
			return json({ error: 'Invalid date format' }, { status: 400 });
		}

		// Validate time format
		if (!isValidTimeObject(data.clockStart) || !isValidTimeObject(data.clockEnd)) {
			return json(
				{ error: 'Invalid time format. Must be { hours: number, minutes: number }' },
				{ status: 400 }
			);
		}

		// Validate time order
		if (!isTimeBefore(data.clockStart, data.clockEnd)) {
			return json({ error: 'End time must be after start time' }, { status: 400 });
		}

		// Check if user exists
		const user = await prisma.user.findUnique({
			where: { id: userId }
		});

		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		// Check for conflicting bookings using raw SQL
		const conflictingBooking = await prisma.$queryRaw`
			SELECT * FROM "booking"
			WHERE "room" = ${data.room}
			AND "date" = ${bookingDate}
			AND (
				(("clockStart"->>'hours')::int <= ${data.clockStart.hours} AND ("clockEnd"->>'hours')::int > ${data.clockStart.hours})
				OR (("clockStart"->>'hours')::int < ${data.clockEnd.hours} AND ("clockEnd"->>'hours')::int >= ${data.clockEnd.hours})
				OR (("clockStart"->>'hours')::int >= ${data.clockStart.hours} AND ("clockEnd"->>'hours')::int <= ${data.clockEnd.hours})
			)
			LIMIT 1
		`;

		if (conflictingBooking && Array.isArray(conflictingBooking) && conflictingBooking.length > 0) {
			return json({ error: 'Room is already booked for this time period' }, { status: 409 });
		}

		const booking = await prisma.booking.create({
			data: {
				userId,
				date: bookingDate,
				event: data.event,
				clockStart: data.clockStart,
				clockEnd: data.clockEnd,
				room: data.room,
				pic: data.pic,
				kapasitas: data.kapasitas,
				rapat: data.rapat,
				catatan: data.catatan
			},
			include: {
				user: {
					select: {
						id: true,
						username: true,
						createdAt: true,
						updatedAt: true
					}
				}
			}
		});

		return json(booking, { status: 201 });
	} catch (error) {
		console.error('Error creating booking:', error);
		return json({ error: 'Failed to create booking' }, { status: 500 });
	}
});

// Helper functions
function isValidTimeObject(time: any): boolean {
	return (
		typeof time === 'object' &&
		time !== null &&
		typeof time.hours === 'number' &&
		typeof time.minutes === 'number' &&
		time.hours >= 0 &&
		time.hours <= 23 &&
		time.minutes >= 0 &&
		time.minutes <= 59
	);
}

function isTimeBefore(
	start: { hours: number; minutes: number },
	end: { hours: number; minutes: number }
): boolean {
	const startMinutes = start.hours * 60 + start.minutes;
	const endMinutes = end.hours * 60 + end.minutes;
	return startMinutes < endMinutes;
}
