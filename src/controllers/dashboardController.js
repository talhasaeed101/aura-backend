const Vehicle = require("../models/Vehicle");
const Service = require("../models/Service");
const UseCase = require("../models/UseCase");
const CaseStudy = require("../models/CaseStudy");
const BlogPost = require("../models/BlogPost");
const Inquiry = require("../models/Inquiry");
const asyncHandler = require("../utils/asyncHandler");
const { toClientDocs } = require("../utils/document");
const { sendSuccess } = require("../utils/response");
const { getRecentActivity } = require("../services/activityService");

async function buildInquiryTrend() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const rows = await Inquiry.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo } } },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const map = new Map(
    rows.map((row) => [`${row._id.year}-${row._id.month}`, row.count])
  );

  const trend = [];
  const cursor = new Date(sixMonthsAgo);
  for (let i = 0; i < 6; i += 1) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}`;
    trend.push({
      month: monthNames[cursor.getMonth()],
      count: map.get(key) || 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return trend;
}

const getDashboard = asyncHandler(async (_req, res) => {
  const [
    totalVehicles,
    publishedServices,
    publishedCaseStudies,
    blogPosts,
    newInquiries,
    available,
    booked,
    maintenance,
    servicesPublished,
    servicesDraft,
    useCasesPublished,
    useCasesDraft,
    caseStudiesPublished,
    caseStudiesDraft,
    blogPublished,
    blogDraft,
    fleetPublished,
    fleetDraft,
    recentInquiries,
    recentActivity,
    inquiryTrend,
  ] = await Promise.all([
    Vehicle.countDocuments({}),
    Service.countDocuments({ publishStatus: "published" }),
    CaseStudy.countDocuments({
      publishStatus: "published",
      isDemoContent: false,
    }),
    BlogPost.countDocuments({}),
    Inquiry.countDocuments({ status: "new" }),
    Vehicle.countDocuments({ availabilityStatus: "available" }),
    Vehicle.countDocuments({ availabilityStatus: "booked" }),
    Vehicle.countDocuments({ availabilityStatus: "maintenance" }),
    Service.countDocuments({ publishStatus: "published" }),
    Service.countDocuments({ publishStatus: "draft" }),
    UseCase.countDocuments({ publishStatus: "published" }),
    UseCase.countDocuments({ publishStatus: "draft" }),
    CaseStudy.countDocuments({ publishStatus: "published" }),
    CaseStudy.countDocuments({ publishStatus: "draft" }),
    BlogPost.countDocuments({ publishStatus: "published" }),
    BlogPost.countDocuments({ publishStatus: "draft" }),
    Vehicle.countDocuments({ publishStatus: "published" }),
    Vehicle.countDocuments({ publishStatus: "draft" }),
    Inquiry.find({}).sort({ createdAt: -1 }).limit(5),
    getRecentActivity(7),
    buildInquiryTrend(),
  ]);

  const data = {
    stats: {
      totalVehicles,
      publishedServices,
      publishedCaseStudies,
      blogPosts,
      newInquiries,
    },
    recentInquiries: toClientDocs(recentInquiries),
    recentActivity: recentActivity.map((item) => ({
      id: String(item._id),
      kind: item.kind,
      title: item.title,
      detail: item.detail,
      at: item.at,
    })),
    fleetStatus: {
      available,
      booked,
      maintenance,
    },
    contentSummary: [
      { label: "Fleet", published: fleetPublished, draft: fleetDraft },
      { label: "Services", published: servicesPublished, draft: servicesDraft },
      { label: "Use cases", published: useCasesPublished, draft: useCasesDraft },
      {
        label: "Case studies",
        published: caseStudiesPublished,
        draft: caseStudiesDraft,
      },
      { label: "Blog", published: blogPublished, draft: blogDraft },
    ],
    inquiryTrend,
  };

  return sendSuccess(res, {
    message: "Dashboard data retrieved.",
    data,
  });
});

module.exports = {
  getDashboard,
};
