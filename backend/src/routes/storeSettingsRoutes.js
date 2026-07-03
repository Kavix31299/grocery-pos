const express = require('express');
const storeSettingsController = require('../controllers/storeSettingsController');
const { verifyAuthToken, checkUserRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(verifyAuthToken);
router.use(checkUserRole(ROLES.ADMIN));

router.route('/')
  .get(storeSettingsController.getStoreSettings)
  .put(storeSettingsController.createStoreSettings)
  .patch(storeSettingsController.updateStoreSettings);

module.exports = router;
