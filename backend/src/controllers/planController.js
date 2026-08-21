const planService = require('../services/planService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

exports.generatePlan = asyncHandler(async (req, res) => {
    const { scanId, age, gender, activityLevel, activity_level, trainingDaysPerWeek, training_days, allergies, disease, diseases, budget, budgetLevel, previous_scan, previousScan } = req.body;
    
    if (!scanId) {
        return res.status(400).json({ status: 'error', message: 'scanId is required' });
    }

    const payload = {
        age,
        gender,
        activity_level: activityLevel || activity_level,
        training_days: trainingDaysPerWeek || training_days,
        allergies,
        disease: disease || diseases,
        budget: budget || budgetLevel,
        // ✅ FIX: Pass previous_scan for InBody Progress comparison
        previous_scan: previous_scan || previousScan || null,
    };

    const result = await planService.generatePlan(req.user.userId, scanId, payload);
    
    // ✅ FIX: Always expose scan_id and plan_id at the top level of response
    // Flutter needs scan_id to call POST /api/plans/save
    const responseData = {
        scanId:   scanId,
        scan_id:  result.scan_id  || scanId,
        plan_id:  result.plan_id  || null,
        ...result
    };

    success(res, responseData);
});

exports.savePlan = asyncHandler(async (req, res) => {
    const { scanId } = req.body;
    let aiResponse = req.body.aiResponse;
    
    // ✅ FIX: If Flutter sends a flattened object instead of wrapping it in `aiResponse`, 
    // extract it from the root body.
    if (!aiResponse) {
        aiResponse = { ...req.body };
        delete aiResponse.scanId;
    }

    if (!scanId || !aiResponse || Object.keys(aiResponse).length === 0) {
        return res.status(400).json({ status: 'error', message: 'scanId and aiResponse (or plan data) are required' });
    }

    // If aiResponse is passed as a string, parse it
    if (typeof aiResponse === 'string') {
        try {
            aiResponse = JSON.parse(aiResponse);
        } catch (e) {
            return res.status(400).json({ status: 'error', message: 'aiResponse must be valid JSON' });
        }
    }

    // If the mobile app passed the entire API response { status: "success", data: {...} }
    if (aiResponse.data && typeof aiResponse.data === 'object') {
        aiResponse = aiResponse.data;
    }

    const result = await planService.saveGeneratedPlan(req.user.userId, scanId, aiResponse);

    // ✅ FIX: Expose plan_id clearly at the top level so Flutter can use it for PDF download
    // Flutter should use: GET /api/plans/{plan_id}/pdf  after saving
    success(res, {
        saved:    result.saved   || true,
        plan_id:  result.plan_id || null,
        pdf_url:  result.plan_id ? `/api/plans/${result.plan_id}/pdf` : null,
    }, 201);
});

exports.downloadPdf = asyncHandler(async (req, res) => {
    const pdfBuffer = await planService.generatePdf(req.user.userId, req.params.planId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="smartgym-report-${req.params.planId}.pdf"`);
    res.send(pdfBuffer);
});
