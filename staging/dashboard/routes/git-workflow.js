const express = require('express');
const router = express.Router();
const GitWorkflowManager = require('../../scripts/git-workflow-manager');

const gitManager = new GitWorkflowManager();

// Получение статуса Git workflow
router.get('/status', async (req, res) => {
    try {
        const status = await gitManager.getWorkflowStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Создание feature ветки
router.post('/create-feature', async (req, res) => {
    try {
        const { featureName } = req.body;
        
        if (!featureName) {
            return res.status(400).json({
                success: false,
                error: 'Название фичи обязательно'
            });
        }
        
        const result = await gitManager.createFeatureBranch(featureName);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Merge feature → develop
router.post('/merge-feature-to-develop', async (req, res) => {
    try {
        const { featureName } = req.body;
        
        if (!featureName) {
            return res.status(400).json({
                success: false,
                error: 'Название фичи обязательно'
            });
        }
        
        const result = await gitManager.mergeFeatureToDevelop(featureName);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Merge develop → staging
router.post('/merge-develop-to-staging', async (req, res) => {
    try {
        const result = await gitManager.mergeDevelopToStaging();
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Merge staging → main (production)
router.post('/merge-staging-to-main', async (req, res) => {
    try {
        const result = await gitManager.mergeStagingToMain();
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Создание staging ветки
router.post('/ensure-staging', async (req, res) => {
    try {
        const result = await gitManager.ensureStagingBranch();
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получение списка веток
router.get('/branches', async (req, res) => {
    try {
        const branches = await gitManager.getAllBranches();
        const currentBranch = await gitManager.getCurrentBranch();
        
        res.json({
            success: true,
            data: {
                branches,
                currentBranch
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router; 