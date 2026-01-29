"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureRollingSlots = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const toMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
};
const ensureRollingSlots = async (weeksAhead = 4) => {
    const rules = await prisma_1.prisma.availabilityRule.findMany({
        where: { active: true, mode: client_1.AvailabilityMode.ONE_TIME },
    });
    const startDate = new Date();
    const totalDays = weeksAhead * 7;
    for (const rule of rules) {
        const startMinutes = toMinutes(rule.startTime);
        const slots = [];
        for (let day = 0; day <= totalDays; day += 1) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + day);
            if (date.getDay() !== rule.weekday) {
                continue;
            }
            const slotStart = new Date(date);
            slotStart.setHours(0, 0, 0, 0);
            slotStart.setMinutes(startMinutes);
            const slotEnd = new Date(slotStart);
            slotEnd.setMinutes(slotStart.getMinutes() + rule.durationMinutes);
            slots.push({
                mentorId: rule.mentorId,
                ruleId: rule.id,
                startAt: slotStart,
                endAt: slotEnd,
                durationMinutes: rule.durationMinutes,
                priceInr: rule.priceInr,
                title: rule.title,
                meetingLink: rule.meetingLink,
                mode: rule.mode,
            });
        }
        if (slots.length) {
            await prisma_1.prisma.availabilitySlot.createMany({
                data: slots,
                skipDuplicates: true,
            });
        }
    }
};
exports.ensureRollingSlots = ensureRollingSlots;
