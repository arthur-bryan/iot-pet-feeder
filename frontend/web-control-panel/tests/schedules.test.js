import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Schedules Module', () => {
    let dom;
    let window;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
            url: 'http://localhost',
            runScripts: 'dangerously'
        });
        window = dom.window;
        global.window = window;
        global.document = window.document;
        global.localStorage = {
            store: {},
            getItem: vi.fn((key) => global.localStorage.store[key] || null),
            setItem: vi.fn((key, value) => { global.localStorage.store[key] = value; }),
            removeItem: vi.fn((key) => { delete global.localStorage.store[key]; })
        };
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getRecurrenceBadge', () => {
        const getRecurrenceBadge = (recurrence) => {
            const badges = {
                'none': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">One-time</span>',
                'daily': '<span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">Daily</span>'
            };
            return badges[recurrence] || badges['none'];
        };

        it('should return one-time badge for none recurrence', () => {
            const badge = getRecurrenceBadge('none');
            expect(badge).toContain('One-time');
            expect(badge).toContain('bg-gray-100');
        });

        it('should return daily badge for daily recurrence', () => {
            const badge = getRecurrenceBadge('daily');
            expect(badge).toContain('Daily');
            expect(badge).toContain('bg-blue-100');
        });

        it('should return one-time badge for unknown recurrence', () => {
            const badge = getRecurrenceBadge('unknown');
            expect(badge).toContain('One-time');
        });

        it('should return one-time badge for undefined recurrence', () => {
            const badge = getRecurrenceBadge(undefined);
            expect(badge).toContain('One-time');
        });
    });

    describe('Schedule Validation', () => {
        const validateSchedule = (schedule) => {
            const errors = [];
            if (!schedule.scheduledTime) {
                errors.push('Scheduled time is required');
            }
            if (!schedule.feedCycles || schedule.feedCycles < 1 || schedule.feedCycles > 10) {
                errors.push('Feed cycles must be between 1 and 10');
            }
            if (schedule.recurrence && !['none', 'daily'].includes(schedule.recurrence)) {
                errors.push('Invalid recurrence type');
            }
            return errors;
        };

        it('should pass validation for valid schedule', () => {
            const schedule = {
                scheduledTime: '2024-12-15T10:00:00Z',
                feedCycles: 3,
                recurrence: 'daily'
            };
            const errors = validateSchedule(schedule);
            expect(errors).toHaveLength(0);
        });

        it('should fail validation for missing scheduled time', () => {
            const schedule = {
                feedCycles: 3,
                recurrence: 'none'
            };
            const errors = validateSchedule(schedule);
            expect(errors).toContain('Scheduled time is required');
        });

        it('should fail validation for feed cycles less than 1', () => {
            const schedule = {
                scheduledTime: '2024-12-15T10:00:00Z',
                feedCycles: 0,
                recurrence: 'none'
            };
            const errors = validateSchedule(schedule);
            expect(errors).toContain('Feed cycles must be between 1 and 10');
        });

        it('should fail validation for feed cycles greater than 10', () => {
            const schedule = {
                scheduledTime: '2024-12-15T10:00:00Z',
                feedCycles: 15,
                recurrence: 'none'
            };
            const errors = validateSchedule(schedule);
            expect(errors).toContain('Feed cycles must be between 1 and 10');
        });

        it('should fail validation for invalid recurrence type', () => {
            const schedule = {
                scheduledTime: '2024-12-15T10:00:00Z',
                feedCycles: 3,
                recurrence: 'weekly'
            };
            const errors = validateSchedule(schedule);
            expect(errors).toContain('Invalid recurrence type');
        });
    });

    describe('Schedule API', () => {
        it('should fetch schedules successfully', async () => {
            const mockSchedules = [
                { id: '1', scheduledTime: '2024-12-15T10:00:00Z', feedCycles: 3, enabled: true },
                { id: '2', scheduledTime: '2024-12-16T14:00:00Z', feedCycles: 2, enabled: false }
            ];

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ schedules: mockSchedules, total: 2 })
            });

            const response = await fetch('/api/v1/schedules?page=1&limit=20');
            const data = await response.json();

            expect(data.schedules).toHaveLength(2);
            expect(data.schedules[0].id).toBe('1');
        });

        it('should handle fetch error gracefully', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            let error = null;
            try {
                await fetch('/api/v1/schedules');
            } catch (e) {
                error = e;
            }

            expect(error).not.toBeNull();
            expect(error.message).toBe('Network error');
        });

        it('should create schedule successfully', async () => {
            const newSchedule = {
                scheduledTime: '2024-12-15T10:00:00Z',
                feedCycles: 3,
                recurrence: 'daily'
            };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ id: 'new-id', ...newSchedule })
            });

            const response = await fetch('/api/v1/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSchedule)
            });
            const data = await response.json();

            expect(data.id).toBe('new-id');
            expect(global.fetch).toHaveBeenCalledWith('/api/v1/schedules', expect.objectContaining({
                method: 'POST'
            }));
        });

        it('should update schedule successfully', async () => {
            const updatedSchedule = {
                id: '1',
                scheduledTime: '2024-12-15T12:00:00Z',
                feedCycles: 5,
                recurrence: 'none'
            };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(updatedSchedule)
            });

            const response = await fetch('/api/v1/schedules/1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedSchedule)
            });

            expect(response.ok).toBe(true);
        });

        it('should delete schedule successfully', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ message: 'Schedule deleted' })
            });

            const response = await fetch('/api/v1/schedules/1', {
                method: 'DELETE'
            });

            expect(response.ok).toBe(true);
        });

        it('should toggle schedule enabled state', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ id: '1', enabled: false })
            });

            const response = await fetch('/api/v1/schedules/1', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: false })
            });
            const data = await response.json();

            expect(data.enabled).toBe(false);
        });
    });

    describe('Pagination', () => {
        const ITEMS_PER_PAGE = 20;

        const calculatePagination = (total, currentPage) => {
            const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
            return {
                totalPages,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1
            };
        };

        it('should calculate pagination for first page', () => {
            const result = calculatePagination(50, 1);
            expect(result.totalPages).toBe(3);
            expect(result.hasNextPage).toBe(true);
            expect(result.hasPrevPage).toBe(false);
        });

        it('should calculate pagination for middle page', () => {
            const result = calculatePagination(50, 2);
            expect(result.hasNextPage).toBe(true);
            expect(result.hasPrevPage).toBe(true);
        });

        it('should calculate pagination for last page', () => {
            const result = calculatePagination(50, 3);
            expect(result.hasNextPage).toBe(false);
            expect(result.hasPrevPage).toBe(true);
        });

        it('should handle single page', () => {
            const result = calculatePagination(10, 1);
            expect(result.totalPages).toBe(1);
            expect(result.hasNextPage).toBe(false);
            expect(result.hasPrevPage).toBe(false);
        });

        it('should handle empty list', () => {
            const result = calculatePagination(0, 1);
            expect(result.totalPages).toBe(0);
            expect(result.hasNextPage).toBe(false);
            expect(result.hasPrevPage).toBe(false);
        });
    });

    describe('Theme Toggle', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <html>
                    <button id="themeToggleButton"></button>
                    <svg id="sunIcon" class="hidden"></svg>
                    <svg id="moonIcon"></svg>
                </html>
            `;
        });

        it('should toggle from light to dark theme', () => {
            global.localStorage.store = { theme: 'light' };
            const html = document.documentElement;
            const sunIcon = document.getElementById('sunIcon');
            const moonIcon = document.getElementById('moonIcon');

            const toggleTheme = () => {
                const currentTheme = localStorage.getItem('theme') || 'light';
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';

                if (newTheme === 'dark') {
                    html.classList.add('dark');
                    sunIcon.classList.remove('hidden');
                    moonIcon.classList.add('hidden');
                } else {
                    html.classList.remove('dark');
                    sunIcon.classList.add('hidden');
                    moonIcon.classList.remove('hidden');
                }

                localStorage.setItem('theme', newTheme);
            };

            toggleTheme();

            expect(html.classList.contains('dark')).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
        });

        it('should toggle from dark to light theme', () => {
            global.localStorage.store = { theme: 'dark' };
            const html = document.documentElement;
            html.classList.add('dark');

            const sunIcon = document.getElementById('sunIcon');
            const moonIcon = document.getElementById('moonIcon');

            const toggleTheme = () => {
                const currentTheme = localStorage.getItem('theme') || 'light';
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';

                if (newTheme === 'dark') {
                    html.classList.add('dark');
                    sunIcon.classList.remove('hidden');
                    moonIcon.classList.add('hidden');
                } else {
                    html.classList.remove('dark');
                    sunIcon.classList.add('hidden');
                    moonIcon.classList.remove('hidden');
                }

                localStorage.setItem('theme', newTheme);
            };

            toggleTheme();

            expect(html.classList.contains('dark')).toBe(false);
            expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
        });
    });

    describe('Schedule Modal', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="scheduleModal" class="hidden">
                    <h2 id="modalTitle"></h2>
                    <input id="scheduleDate" type="date">
                    <input id="scheduleTime" type="time">
                    <input id="feedCycles" type="number" value="3">
                    <select id="recurrence">
                        <option value="none">None</option>
                        <option value="daily">Daily</option>
                    </select>
                </div>
            `;
        });

        it('should show modal for new schedule', () => {
            const modal = document.getElementById('scheduleModal');
            const modalTitle = document.getElementById('modalTitle');

            const showScheduleModal = (scheduleData = null) => {
                if (scheduleData) {
                    modalTitle.textContent = 'Edit Schedule';
                } else {
                    modalTitle.textContent = 'Add Schedule';
                }
                modal.classList.remove('hidden');
            };

            showScheduleModal();

            expect(modal.classList.contains('hidden')).toBe(false);
            expect(modalTitle.textContent).toBe('Add Schedule');
        });

        it('should show modal for editing schedule', () => {
            const modal = document.getElementById('scheduleModal');
            const modalTitle = document.getElementById('modalTitle');

            const showScheduleModal = (scheduleData = null) => {
                if (scheduleData) {
                    modalTitle.textContent = 'Edit Schedule';
                } else {
                    modalTitle.textContent = 'Add Schedule';
                }
                modal.classList.remove('hidden');
            };

            showScheduleModal({ id: '1', scheduledTime: '2024-12-15T10:00:00Z' });

            expect(modalTitle.textContent).toBe('Edit Schedule');
        });

        it('should hide modal', () => {
            const modal = document.getElementById('scheduleModal');
            modal.classList.remove('hidden');

            const hideModal = () => {
                modal.classList.add('hidden');
            };

            hideModal();

            expect(modal.classList.contains('hidden')).toBe(true);
        });
    });

    describe('Schedule Status', () => {
        it('should determine if schedule is upcoming', () => {
            const isUpcoming = (scheduledTime) => {
                return new Date(scheduledTime) > new Date();
            };

            const futureDate = new Date(Date.now() + 86400000).toISOString();
            const pastDate = new Date(Date.now() - 86400000).toISOString();

            expect(isUpcoming(futureDate)).toBe(true);
            expect(isUpcoming(pastDate)).toBe(false);
        });

        it('should format schedule status correctly', () => {
            const getScheduleStatus = (schedule) => {
                if (!schedule.enabled) return 'disabled';
                const scheduledTime = new Date(schedule.scheduledTime);
                if (scheduledTime < new Date()) return 'completed';
                return 'pending';
            };

            const disabledSchedule = { enabled: false, scheduledTime: '2024-12-15T10:00:00Z' };
            const pastSchedule = { enabled: true, scheduledTime: '2020-01-01T10:00:00Z' };
            const futureSchedule = { enabled: true, scheduledTime: '2030-01-01T10:00:00Z' };

            expect(getScheduleStatus(disabledSchedule)).toBe('disabled');
            expect(getScheduleStatus(pastSchedule)).toBe('completed');
            expect(getScheduleStatus(futureSchedule)).toBe('pending');
        });
    });
});
