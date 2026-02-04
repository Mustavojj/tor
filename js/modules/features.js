import { APP_CONFIG } from '../data.js';

class TaskManager {
    constructor(app) {
        this.app = app;
        this.mainTasks = [];
        this.partnerTasks = [];
        this.socialTasks = [];
        this.taskTimers = new Map();
        this.TASK_PRICES = APP_CONFIG.TASK_PRICES;
        this.PRICE_PER_1000 = APP_CONFIG.PRICE_PER_1000;
    }

    async loadTasksData(forceRefresh = false) {
        const cacheKey = `tasks_${this.app.tgUser.id}`;
        
        if (!forceRefresh) {
            const cached = this.app.cache.get(cacheKey);
            if (cached) {
                this.mainTasks = cached.mainTasks || [];
                this.socialTasks = cached.socialTasks || [];
                return;
            }
        }
        
        try {
            this.mainTasks = await this.loadTasksFromDatabase('main');
            this.socialTasks = await this.loadTasksFromDatabase('social');
            
            this.app.cache.set(cacheKey, {
                mainTasks: this.mainTasks,
                socialTasks: this.socialTasks
            }, 30000);
            
        } catch (error) {
            console.warn('Load tasks data error:', error);
            this.mainTasks = [];
            this.socialTasks = [];
        }
    }

    async loadTasksFromDatabase(category) {
        try {
            if (!this.app.db) return [];
            
            const tasks = [];
            const tasksSnapshot = await this.app.db.ref(`config/tasks`).once('value');
            
            if (tasksSnapshot.exists()) {
                tasksSnapshot.forEach(child => {
                    try {
                        const taskData = child.val();
                        
                        if (taskData.status !== 'active' && taskData.taskStatus !== 'active') {
                            return;
                        }
                        
                        if (taskData.category !== category) {
                            return;
                        }
                        
                        const currentCompletions = taskData.currentCompletions || 0;
                        const maxCompletions = taskData.maxCompletions || 999999;
                        
                        if (currentCompletions >= maxCompletions) {
                            this.app.db.ref(`config/tasks/${child.key}`).update({
                                status: 'completed',
                                taskStatus: 'completed'
                            });
                            return;
                        }
                        
                        const task = { 
                            id: child.key, 
                            name: taskData.name || 'Unknown Task',
                            description: taskData.description || 'Join & Get Reward',
                            picture: taskData.picture || this.app.appConfig.BOT_AVATAR,
                            url: taskData.url || '',
                            type: taskData.type || 'channel',
                            category: category,
                            reward: this.app.safeNumber(taskData.reward || 0.001),
                            currentCompletions: currentCompletions,
                            maxCompletions: maxCompletions
                        };
                        
                        if (!this.app.userCompletedTasks.has(task.id)) {
                            tasks.push(task);
                        }
                    } catch (error) {
                        console.error('Error processing task:', error);
                    }
                });
            }
            
            return tasks;
            
        } catch (error) {
            console.error(`Error loading ${category} tasks:`, error);
            return [];
        }
    }

    getMainTasks() {
        return this.mainTasks;
    }

    getSocialTasks() {
        return this.socialTasks;
    }

    async addNewTask(taskData) {
        try {
            const { name, url, target, checkEnabled, price } = taskData;
            
            if (this.app.userState.balance < price) {
                this.app.notificationManager.showNotification("Error", "Insufficient balance", "error");
                return false;
            }
            
            const newBalance = this.app.userState.balance - price;
            
            if (this.app.db) {
                await this.app.db.ref(`users/${this.app.tgUser.id}`).update({
                    balance: newBalance
                });
                
                const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                const newTask = {
                    id: taskId,
                    name: name,
                    url: url,
                    type: 'channel',
                    category: 'main',
                    reward: 0.001,
                    currentCompletions: 0,
                    maxCompletions: target,
                    status: 'active',
                    taskStatus: 'active',
                    createdBy: this.app.tgUser.id,
                    createdAt: this.app.getServerTime(),
                    checkEnabled: checkEnabled || false
                };
                
                await this.app.db.ref(`config/tasks/${taskId}`).set(newTask);
                
                this.app.userState.balance = newBalance;
                this.app.updateHeader();
                this.app.renderProfilePage();
                
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('Error adding new task:', error);
            return false;
        }
    }
}

class QuestManager {
    constructor(app) {
        this.app = app;
    }

    async loadQuestsData() {
        return;
    }

    async updateQuestsProgress() {
        return;
    }
}

class ReferralManager {
    constructor(app) {
        this.app = app;
        this.recentReferrals = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.isLoading = false;
        this.hasMore = true;
    }

    async loadRecentReferrals() {
        return;
    }

    async handleReferralBonus(referralId) {
        return false;
    }

    async renderReferralsPage() {
        return;
    }

    setupReferralsPageEvents() {
        return;
    }
}

export { TaskManager, QuestManager, ReferralManager };
