import express from 'express';
import { Op } from 'sequelize';
import { Document, User } from '../models/index.js';
import { authenticate, authorize, enforcePolicy } from '../middleware/auth.js';
import { logAudit } from '../middleware/auditLogger.js';

const router = express.Router();

// Helper to extract document resource attributes for ABAC evaluation
const getDocumentResourceAttributes = async (req) => {
  const doc = await Document.findByPk(req.params.id);
  if (!doc) return null;

  return {
    type: 'document',
    id: doc.id,
    department: doc.department,
    classification: doc.classification,
    minClearanceLevel: doc.minClearanceLevel,
    ownerId: doc.ownerId
  };
};

// Get all accessible documents based on ABAC attributes (Clearance, Department, Ownership)
router.get('/',
  authenticate,
  authorize('read:documents'),
  logAudit('view_documents', 'documents'),
  async (req, res) => {
    try {
      const isSuperAdmin = req.user.maxRoleLevel >= 100;
      const userClearance = req.user.clearanceLevel || 1;
      const userDept = req.user.department || 'General';

      let whereClause = {};

      if (!isSuperAdmin) {
        whereClause = {
          [Op.or]: [
            // 1. Any public document
            { classification: 'public' },
            // 2. Documents owned by the user
            { ownerId: req.user.id },
            // 3. Department matching + sufficient clearance
            {
              department: { [Op.in]: [userDept, 'General'] },
              minClearanceLevel: { [Op.lte]: userClearance }
            }
          ]
        };
      }

      const documents = await Document.findAll({
        where: whereClause,
        include: [{
          model: User,
          as: 'owner',
          attributes: ['id', 'username', 'fullName', 'department']
        }],
        order: [['id', 'DESC']]
      });

      res.json({
        success: true,
        count: documents.length,
        userContext: {
          username: req.user.username,
          department: req.user.department,
          clearanceLevel: req.user.clearanceLevel,
          maxRoleLevel: req.user.maxRoleLevel
        },
        documents
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch documents',
        error: error.message
      });
    }
  }
);

// Get single document with detailed ABAC policy inspection
router.get('/:id',
  authenticate,
  authorize('read:documents'),
  enforcePolicy('document', 'read', getDocumentResourceAttributes),
  async (req, res) => {
    try {
      const doc = await Document.findByPk(req.params.id, {
        include: [{
          model: User,
          as: 'owner',
          attributes: ['id', 'username', 'fullName', 'department']
        }]
      });

      if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found' });
      }

      res.json({
        success: true,
        document: doc,
        policyDecision: req.policyDecision
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch document', error: error.message });
    }
  }
);

// Create document (ABAC evaluated: user department scoping)
router.post('/',
  authenticate,
  authorize('create:documents'),
  logAudit('create_document', 'documents'),
  async (req, res) => {
    try {
      const {
        title,
        content,
        department = req.user.department || 'General',
        classification = 'internal',
        minClearanceLevel = 1
      } = req.body;

      // Superadmins can assign any department, other users are scoped to their own department
      if (req.user.maxRoleLevel < 100 && department !== req.user.department && department !== 'General') {
        return res.status(403).json({
          success: false,
          message: `ABAC Restriction: You can only create documents for your own department (${req.user.department}) or General.`
        });
      }

      const doc = await Document.create({
        title,
        content,
        department,
        classification,
        minClearanceLevel: Number(minClearanceLevel) || 1,
        ownerId: req.user.id
      });

      const createdDoc = await Document.findByPk(doc.id, {
        include: [{
          model: User,
          as: 'owner',
          attributes: ['id', 'username', 'fullName', 'department']
        }]
      });

      res.status(201).json({
        success: true,
        message: 'Document created successfully',
        document: createdDoc
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to create document', error: error.message });
    }
  }
);

// Update document (Owner, Department Manager with clearance, or Superadmin)
router.put('/:id',
  authenticate,
  authorize('update:documents'),
  enforcePolicy('document', 'update', getDocumentResourceAttributes),
  logAudit('update_document', 'documents'),
  async (req, res) => {
    try {
      const { title, content, department, classification, minClearanceLevel } = req.body;
      const doc = await Document.findByPk(req.params.id);

      if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found' });
      }

      if (title) doc.title = title;
      if (content) doc.content = content;
      if (department && req.user.maxRoleLevel >= 100) doc.department = department;
      if (classification) doc.classification = classification;
      if (minClearanceLevel !== undefined) doc.minClearanceLevel = Number(minClearanceLevel);

      await doc.save();

      const updated = await Document.findByPk(doc.id, {
        include: [{
          model: User,
          as: 'owner',
          attributes: ['id', 'username', 'fullName', 'department']
        }]
      });

      res.json({
        success: true,
        message: 'Document updated successfully',
        document: updated
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update document', error: error.message });
    }
  }
);

// Delete document
router.delete('/:id',
  authenticate,
  authorize('delete:documents'),
  enforcePolicy('document', 'delete', getDocumentResourceAttributes),
  logAudit('delete_document', 'documents'),
  async (req, res) => {
    try {
      const doc = await Document.findByPk(req.params.id);
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found' });
      }

      await doc.destroy();
      res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete document', error: error.message });
    }
  }
);

export default router;

