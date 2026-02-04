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

    async checkBotAdminStatus(chatId) {
        try {
            if (!this.app.tgUser?.id) return false;
            
            const response = await fetch('/api/telegram-bot', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': this.app.tgUser.id.toString(),
                    'x-telegram-hash': this.app.tg?.initData || ''
                },
                body: JSON.stringify({
                    action: 'getChatAdministrators',
                    params: { chat_id: chatId }
                })
            });
            
            if (!response.ok) {
                console.error('Bot admin check failed');
                return false;
            }
            
            const data = await response.json();
            if (data.ok && data.result) {
                const admins = data.result;
                const isBotAdmin = admins.some(admin => {
                    const isBot = admin.user?.is_bot;
                    const isThisBot = admin.user?.username === APP_CONFIG.BOT_USERNAME;
                    return isBot && isThisBot;
                });
                return isBotAdmin;
            }
            return false;
        } catch (error) {
            console.error('Error checking bot admin status:', error);
            return false;
        }
    }
    
    async checkUserMembershipWithBot(chatId) {
        try {
            const userId = this.app.tgUser?.id;
            if (!userId) return false;
            
            const response = await fetch('/api/telegram-bot', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': userId.toString(),
                    'x-telegram-hash': this.app.tg?.initData || ''
                },
                body: JSON.stringify({
                    action: 'getChatMember',
                    params: {
                        chat_id: chatId,
                        user_id: userId
                    }
                })
            });
            
            if (!response.ok) {
                console.error('Telegram API request failed');
                return false;
            }
            
            const data = await response.json();
            if (!data.ok || !data.result) {
                console.error('Telegram API response not ok:', data);
                return false;
            }
            
            const userStatus = data.result.status;
            const isMember = ['member', 'administrator', 'creator', 'restricted'].includes(userStatus);
            
            console.log(`User ${userId} membership status in ${chatId}: ${userStatus} -> ${isMember}`);
            return isMember;
        } catch (error) {
            console.error('Error checking user membership with bot:', error);
            return false;
        }
    }

    async handleTask(taskId, url, taskType, reward, button) {
        if (this.app.userCompletedTasks.has(taskId)) {
            this.app.notificationManager.showNotification("Already Completed", "You have already completed this task", "info");
            return;
        }
        
        if (this.app.isProcessingTask) {
            this.app.notificationManager.showNotification("Busy", "Please complete current task first", "warning");
            return;
        }
        
        const rateLimitCheck = this.app.rateLimiter.checkLimit(this.app.tgUser.id, 'task_start');
        if (!rateLimitCheck.allowed) {
            this.app.notificationManager.showNotification(
                "Rate Limit", 
                `Please wait ${rateLimitCheck.remaining} seconds before starting another task`, 
                "warning"
            );
            return;
        }
        
        this.app.rateLimiter.addRequest(this.app.tgUser.id, 'task_start');
        
        window.open(url, '_blank');
        
        this.disableAllTaskButtons();
        this.app.isProcessingTask = true;
        
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wait 10s';
        button.disabled = true;
        button.classList.remove('start');
        button.classList.add('counting');
        
        let secondsLeft = 10;
        const countdown = setInterval(() => {
            secondsLeft--;
            if (secondsLeft > 0) {
                button.innerHTML = `<i class="fas fa-clock"></i> ${secondsLeft}s`;
            } else {
                clearInterval(countdown);
                button.innerHTML = 'CHECK';
                button.disabled = false;
                button.classList.remove('counting');
                button.classList.add('check');
                
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                
                newButton.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await this.handleCheckTask(taskId, url, taskType, reward, newButton);
                });
            }
        }, 1000);
        
        setTimeout(() => {
            if (secondsLeft > 0) {
                clearInterval(countdown);
                button.innerHTML = originalText;
                button.disabled = false;
                button.classList.remove('counting');
                button.classList.add('start');
                this.enableAllTaskButtons();
                this.app.isProcessingTask = false;
            }
        }, 11000);
    }

    async handleCheckTask(taskId, url, taskType, reward, button) {
        if (button) {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
            button.disabled = true;
        }
        
        this.disableAllTaskButtons();
        this.app.isProcessingTask = true;
        
        try {
            let task = null;
            for (const t of [...this.mainTasks, ...this.socialTasks]) {
                if (t.id === taskId) {
                    task = t;
                    break;
                }
            }
            
            if (!task) {
                throw new Error("Task not found");
            }
            
            const chatId = this.extractChatIdFromUrl(url);
            
            if (task.type === 'channel' || task.type === 'group') {
                if (chatId) {
                    const isBotAdmin = await this.checkBotAdminStatus(chatId);
                    
                    if (isBotAdmin) {
                        console.log(`Bot is admin in ${chatId}, checking user membership...`);
                        const isSubscribed = await this.checkUserMembershipWithBot(chatId);
                        
                        if (isSubscribed) {
                            console.log(`User is subscribed to ${chatId}, completing task...`);
                            await this.completeTask(taskId, taskType, task.reward, button);
                        } else {
                            console.log(`User is NOT subscribed to ${chatId}`);
                            this.app.notificationManager.showNotification(
                                "Join Required", 
                                "You need to join the channel/group first!", 
                                "error"
                            );
                            
                            this.enableAllTaskButtons();
                            this.app.isProcessingTask = false;
                            
                            if (button) {
                                button.innerHTML = 'Try Again';
                                button.disabled = false;
                                button.classList.remove('check');
                                button.classList.add('start');
                                
                                const newButton = button.cloneNode(true);
                                button.parentNode.replaceChild(newButton, button);
                                
                                newButton.addEventListener('click', async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    await this.handleTask(taskId, url, taskType, task.reward, newButton);
                                });
                            }
                        }
                    } else {
                        console.log(`Bot is NOT admin in ${chatId}, skipping verification`);
                        this.app.notificationManager.showNotification(
                            "Task Completed!", 
                            `You have received ${task.reward.toFixed(5)} TON`, 
                            "success"
                        );
                        
                        await this.completeTask(taskId, taskType, task.reward, button);
                    }
                } else {
                    console.log(`Could not extract chat ID from URL: ${url}`);
                    this.app.notificationManager.showNotification(
                        "Task Completed!", 
                        `You have received ${task.reward.toFixed(5)} TON`, 
                        "success"
                    );
                    
                    await this.completeTask(taskId, taskType, task.reward, button);
                }
            } else {
                console.log(`Task type is not channel/group, completing directly`);
                await this.completeTask(taskId, taskType, task.reward, button);
            }
            
        } catch (error) {
            console.error('Error in handleCheckTask:', error);
            this.enableAllTaskButtons();
            this.app.isProcessingTask = false;
            
            if (button) {
                button.innerHTML = 'Try Again';
                button.disabled = false;
                button.classList.remove('check');
                button.classList.add('start');
                
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                
                newButton.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await this.handleTask(taskId, url, taskType, reward, newButton);
                });
            }
            
            this.app.notificationManager.showNotification("Error", "Failed to verify task completion", "error");
        }
    }

    async completeTask(taskId, taskType, reward, button) {
        try {
            if (!this.app.db) return false;
            
            let task = null;
            for (const t of [...this.mainTasks, ...this.socialTasks]) {
                if (t.id === taskId) {
                    task = t;
                    break;
                }
            }
            
            if (!task) {
                throw new Error("Task not found");
            }
            
            const taskReward = this.app.safeNumber(reward);
            
            const currentBalance = this.app.safeNumber(this.app.userState.balance);
            const totalEarned = this.app.safeNumber(this.app.userState.totalEarned);
            const totalTasks = this.app.safeNumber(this.app.userState.totalTasks);
            
            if (this.app.userCompletedTasks.has(taskId)) {
                this.app.notificationManager.showNotification("Already Completed", "This task was already completed", "info");
                return false;
            }
            
            const currentTime = this.app.getServerTime();
            
            const updates = {};
            updates.balance = currentBalance + taskReward;
            updates.totalEarned = totalEarned + taskReward;
            updates.totalTasks = totalTasks + 1;
            updates.totalTasksCompleted = (this.app.userState.totalTasksCompleted || 0) + 1;
            
            this.app.userCompletedTasks.add(taskId);
            updates.completedTasks = [...this.app.userCompletedTasks];
            
            await this.app.db.ref(`users/${this.app.tgUser.id}`).update(updates);
            
            await this.app.db.ref(`config/tasks/${taskId}/currentCompletions`).transaction(current => {
                const newValue = (current || 0) + 1;
                
                if (newValue >= task.maxCompletions) {
                    this.app.db.ref(`config/tasks/${taskId}`).update({
                        status: 'completed',
                        taskStatus: 'completed'
                    });
                }
                
                return newValue;
            });
            
            this.app.userState.balance = currentBalance + taskReward;
            this.app.userState.totalEarned = totalEarned + taskReward;
            this.app.userState.totalTasks = totalTasks + 1;
            this.app.userState.totalTasksCompleted = (this.app.userState.totalTasksCompleted || 0) + 1;
            this.app.userState.completedTasks = [...this.app.userCompletedTasks];
            
            if (button) {
                const taskCard = document.getElementById(`task-${taskId}`);
                if (taskCard) {
                    const taskBtn = taskCard.querySelector('.task-btn');
                    if (taskBtn) {
                        taskBtn.innerHTML = 'COMPLETED';
                        taskBtn.className = 'task-btn completed';
                        taskBtn.disabled = true;
                        taskCard.classList.add('task-completed');
                    }
                }
            }
            
            this.app.updateHeader();
            this.app.renderProfilePage();
            
            await this.app.updateAppStats('totalTasks', 1);
            
            this.app.cache.delete(`tasks_${this.app.tgUser.id}`);
            this.app.cache.delete(`user_${this.app.tgUser.id}`);

            if (this.app.userState.referredBy) {
                await this.app.processReferralTaskBonus(this.app.userState.referredBy, taskReward);
            }
            
            this.enableAllTaskButtons();
            this.app.isProcessingTask = false;

            this.app.notificationManager.showNotification(
                "Task Completed!", 
                `+${taskReward.toFixed(5)} TON`, 
                "success"
            );
            
            return true;
            
        } catch (error) {
            console.error('Error in completeTask:', error);
            this.enableAllTaskButtons();
            this.app.isProcessingTask = false;
            
            if (button) {
                button.innerHTML = 'Try Again';
                button.disabled = false;
                button.classList.remove('check', 'completed');
                button.classList.add('start');
                
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                
                newButton.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await this.handleTask(taskId, url, taskType, reward, newButton);
                });
            }
            
            throw error;
        }
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

    extractChatIdFromUrl(url) {
        try {
            if (!url) return null;
            
            url = url.toString().trim();
            
            if (url.includes('t.me/')) {
                const match = url.match(/t\.me\/([^\/\?]+)/);
                if (match && match[1]) {
                    const username = match[1];
                    
                    if (username.startsWith('@')) return username;
                    
                    if (/^[a-zA-Z][a-zA-Z0-9_]{4,}$/.test(username)) return '@' + username;
                    
                    return username;
                }
            }
            
            return null;
            
        } catch (error) {
            return null;
        }
    }

    disableAllTaskButtons() {
        document.querySelectorAll('.task-btn:not(.completed):not(.counting):not(:disabled)').forEach(btn => {
            btn.disabled = true;
        });
    }

    enableAllTaskButtons() {
        document.querySelectorAll('.task-btn:not(.completed):not(.counting)').forEach(btn => {
            btn.disabled = false;
        });
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
