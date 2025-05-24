import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { cors } from '$lib/server/cors';

// Helper functions
function isValidClockFormat(clock: any): boolean {
	return (
		typeof clock === 'object' &&
		clock !== null &&
		((typeof clock.hours === 'number' && typeof clock.minutes === 'number') ||
			(typeof clock.hour === 'number' && typeof clock.minute === 'number')) &&
		((clock.hours >= 0 && clock.hours < 24 && clock.minutes >= 0 && clock.minutes < 60) ||
			(clock.hour >= 0 && clock.hour < 24 && clock.minute >= 0 && clock.minute < 60))
	);
}

function isTimeBefore(
	start: { hours?: number; minutes?: number; hour?: number; minute?: number },
	end: { hours?: number; minutes?: number; hour?: number; minute?: number }
): boolean {
	const startHour = start.hours ?? start.hour ?? 0;
	const startMinute = start.minutes ?? start.minute ?? 0;
	const endHour = end.hours ?? end.hour ?? 0;
	const endMinute = end.minutes ?? end.minute ?? 0;

	const startMinutes = startHour * 60 + startMinute;
	const endMinutes = endHour * 60 + endMinute;
	return startMinutes < endMinutes;
}

// GET /api/bookings/[id] - Get a specific booking
export const GET: RequestHandler = cors(async ({ params }) => {
	try {
		const booking = await prisma.booking.findUnique({
			where: { id: params.id },
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

		if (!booking) {
			return json({ error: 'Booking not found' }, { status: 404 });
		}

		return json(booking);
	} catch (error) {
		console.error('Error fetching booking:', error);
		return json({ error: 'Failed to fetch booking' }, { status: 500 });
	}
});

// PUT /api/bookings/[id] - Update a booking
export const PUT: RequestHandler = cors(async ({ params, request }) => {
	try {
		const data = await request.json();
		const bookingId = params.id;

		// Check if booking exists
		const existingBooking = await prisma.booking.findUnique({
			where: { id: bookingId }
		});

		if (!existingBooking) {
			return json({ error: 'Booking not found' }, { status: 404 });
		}

		// Validate date if provided
		let bookingDate = existingBooking.date;
		if (data.date) {
			bookingDate = new Date(data.date);
			if (isNaN(bookingDate.getTime())) {
				return json({ error: 'Invalid date format' }, { status: 400 });
			}
		}

		// Validate clock times if provided
		if (data.clockStart || data.clockEnd) {
			const clockStart = data.clockStart || existingBooking.clockStart;
			const clockEnd = data.clockEnd || existingBooking.clockEnd;

			if (!isValidClockFormat(clockStart) || !isValidClockFormat(clockEnd)) {
				return json(
					{ error: 'Invalid clock format. Must be { hour: number, minute: number }' },
					{ status: 400 }
				);
			}

			if (!isTimeBefore(clockStart, clockEnd)) {
				return json({ error: 'End time must be after start time' }, { status: 400 });
			}

			// Check for booking conflicts (excluding the current booking)
			const conflictingBooking = await prisma.$queryRaw`
				SELECT * FROM "booking"
				WHERE "id" != ${bookingId}
				AND "room" = ${data.room || existingBooking.room}
				AND "date" = ${bookingDate}
				AND (
					(("clockStart"->>'hours')::int <= ${clockStart.hours ?? clockStart.hour} AND ("clockEnd"->>'hours')::int > ${clockStart.hours ?? clockStart.hour})
					OR (("clockStart"->>'hours')::int < ${clockEnd.hours ?? clockEnd.hour} AND ("clockEnd"->>'hours')::int >= ${clockEnd.hours ?? clockEnd.hour})
					OR (("clockStart"->>'hours')::int >= ${clockStart.hours ?? clockStart.hour} AND ("clockEnd"->>'hours')::int <= ${clockEnd.hours ?? clockEnd.hour})
				)
				LIMIT 1
			`;

			if (
				conflictingBooking &&
				Array.isArray(conflictingBooking) &&
				conflictingBooking.length > 0
			) {
				return json({ error: 'Room is already booked for this time period' }, { status: 409 });
			}
		}

		// Check if user exists if userId is provided
		if (data.userId) {
			const user = await prisma.user.findUnique({
				where: { id: data.userId }
			});

			if (!user) {
				return json({ error: 'User not found' }, { status: 404 });
			}
		}

		// Create update data object with only provided fields
		const updateData: any = {};

		// Only add fields that are provided in the request
		if ('userId' in data) updateData.userId = data.userId;
		if ('date' in data) updateData.date = bookingDate;
		if ('event' in data) updateData.event = data.event;
		if ('clockStart' in data) updateData.clockStart = data.clockStart;
		if ('clockEnd' in data) updateData.clockEnd = data.clockEnd;
		if ('room' in data) updateData.room = data.room;
		if ('pic' in data) updateData.pic = data.pic;
		if ('kapasitas' in data) updateData.kapasitas = data.kapasitas;
		if ('rapat' in data) updateData.rapat = data.rapat;
		if ('catatan' in data) updateData.catatan = data.catatan;

		const updatedBooking = await prisma.booking.update({
			where: { id: bookingId },
			data: updateData,
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

		return json(updatedBooking);
	} catch (error) {
		console.error('Error updating booking:', error);
		return json({ error: 'Failed to update booking' }, { status: 500 });
	}
});

// DELETE /api/bookings/[id] - Delete a booking
export const DELETE: RequestHandler = cors(async ({ params }) => {
	try {
		const bookingId = params.id;

		// Check if booking exists
		const existingBooking = await prisma.booking.findUnique({
			where: { id: bookingId }
		});

		if (!existingBooking) {
			return json({ error: 'Booking not found' }, { status: 404 });
		}

		await prisma.booking.delete({
			where: { id: bookingId }
		});

		return json({ message: 'Booking deleted successfully' });
	} catch (error) {
		console.error('Error deleting booking:', error);
		return json({ error: 'Failed to delete booking' }, { status: 500 });
	}
});
