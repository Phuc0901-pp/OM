import { describe, it, expect } from 'vitest';
import type { TaskDetail, Allocation, TaskStats, DetailedTask } from '../types/allocation';

describe('Allocation Types', () => {
    describe('TaskDetail', () => {
        it('should allow valid TaskDetail object', () => {
            const task: TaskDetail = {
                id: 'uuid-1234',
                child_category_id: 'uuid-5678',
                status: 'pending',
                check: 0,
                accept: 0,
                note: '',
                image_path: '',
                updated_at: '2026-02-02T00:00:00Z',
            };

            expect(task.id).toBe('uuid-1234');
            expect(task.status_work).toBeUndefined();
            expect(task.status_approve).toBeUndefined();
        });

        it('should allow optional fields', () => {
            const task: TaskDetail = {
                id: 'uuid-1234',
                child_category_id: 'uuid-5678',
                status: 'approved',
                check: 1,
                accept: 1,
                note: 'Test note',
                image_path: '/path/to/image.jpg',
                updated_at: '2026-02-02T00:00:00Z',
                station_name: 'Station A',
                inverter_name: 'Inverter 1',
                process_id: 'proc-uuid',
                status_work: 1,
                status_submit: 1,
                status_approve: 1,
                status_reject: 0,
                image_url: '["url1","url2"]',
                submitted_at: '2026-02-01T10:00:00Z',
                approval_at: '2026-02-02T08:00:00Z',
            };

            expect(task.station_name).toBe('Station A');
            expect(task.status_approve).toBe(1);
            expect(task.process_id).toBe('proc-uuid');
        });

        it('should handle nested child_category', () => {
            const task: TaskDetail = {
                id: 'uuid-1234',
                child_category_id: 'uuid-5678',
                status: 'in_progress',
                check: 0,
                accept: 0,
                note: '',
                image_path: '',
                updated_at: '2026-02-02T00:00:00Z',
                child_category: {
                    name: 'Cleaning PV Modules',
                    station_id: 'station-uuid',
                    station: { name: 'Station A' },
                    main_category: { name: 'Maintenance' },
                },
            };

            expect(task.child_category?.name).toBe('Cleaning PV Modules');
            expect(task.child_category?.main_category?.name).toBe('Maintenance');
        });
    });

    describe('TaskStats', () => {
        it('should calculate stats correctly', () => {
            const stats: TaskStats = {
                total: 100,
                approved: 40,
                rejected: 10,
                submitted: 20,
                inProgress: 15,
                pending: 15,
            };

            expect(stats.total).toBe(100);
            expect(stats.approved + stats.rejected + stats.submitted + stats.inProgress + stats.pending).toBe(100);
        });

        it('should allow zero values', () => {
            const stats: TaskStats = {
                total: 0,
                approved: 0,
                rejected: 0,
                submitted: 0,
                inProgress: 0,
                pending: 0,
            };

            expect(stats.total).toBe(0);
        });
    });

    describe('DetailedTask', () => {
        it('should have correct status union type', () => {
            const validStatuses: DetailedTask['status'][] = [
                'approved',
                'rejected',
                'submitted',
                'in_progress',
                'pending',
            ];

            validStatuses.forEach((status) => {
                const task: DetailedTask = {
                    id: 'test',
                    projectName: 'Project A',
                    classificationName: 'Solar Farm',
                    categoryName: 'Maintenance',
                    itemName: 'PV Cleaning',
                    status,
                    note: '',
                };
                expect(task.status).toBe(status);
            });
        });
    });

    describe('Allocation', () => {
        it('should have valid structure', () => {
            const allocation: Allocation = {
                id: 'alloc-uuid',
                project_id: 'proj-uuid',
                id_project: 'proj-uuid',
                project: { project_name: 'Solar Farm A', location: 'Vietnam' },
                classification: { name: 'Rooftop' },
                data_work: {
                    timestamp: '2026-02-02T00:00:00Z',
                    main_categories: [
                        {
                            name: 'Electrical',
                            id: 'cat-1',
                            num: '1',
                            child_categories: [
                                { name: 'Cable Check', id: 'child-1', quantity: '10' },
                            ],
                        },
                    ],
                },
            };

            expect(allocation.project.project_name).toBe('Solar Farm A');
            expect(allocation.data_work.main_categories.length).toBeGreaterThan(0);
        });

        it('should handle optional task_details', () => {
            const allocation: Allocation = {
                id: 'alloc-uuid',
                project_id: 'proj-uuid',
                id_project: 'proj-uuid',
                project: { project_name: 'Test', location: 'Test' },
                classification: { name: 'Test' },
                data_work: { timestamp: '', main_categories: [] },
                task_details: [
                    {
                        id: 'task-1',
                        child_category_id: 'child-1',
                        status: 'pending',
                        check: 0,
                        accept: 0,
                        note: '',
                        image_path: '',
                        updated_at: '',
                    },
                ],
            };

            expect(allocation.task_details?.length).toBe(1);
        });
    });
});
