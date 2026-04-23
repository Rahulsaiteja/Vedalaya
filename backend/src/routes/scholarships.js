import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Mock data for Indian school student scholarships
const mockScholarships = [
  {
    id: '1',
    title: 'Pre-Matric Scholarship for Minorities',
    description: 'Aimed at encouraging parents from minority communities to send their school-going children to school, lighten their financial burden on school education and sustain their efforts to support their children to complete school education.',
    eligibility: 'Class 1 to 10. Minimum 50% marks in previous exam. Family income < ₹1 Lakh.',
    amount: 'Up to ₹1,000 per annum',
    deadline: '2026-10-31',
    category: 'Government',
    url: 'https://scholarships.gov.in/'
  },
  {
    id: '2',
    title: 'National Means Cum Merit Scholarship (NMMS)',
    description: 'Awarded to meritorious students of economically weaker sections to arrest their drop out at class VIII and encourage them to continue study at secondary stage.',
    eligibility: 'Class 9 to 12. Must have passed class 8 with 55%. Family income < ₹3.5 Lakh.',
    amount: '₹12,000 per annum',
    deadline: '2026-11-30',
    category: 'Merit-Based',
    url: 'https://scholarships.gov.in/'
  },
  {
    id: '3',
    title: 'Begum Hazrat Mahal National Scholarship',
    description: 'Given to meritorious girl students belonging to minority communities to help them continue their higher secondary education.',
    eligibility: 'Girls from Class 9 to 12. Minimum 50% in previous class. Family income < ₹2 Lakh.',
    amount: '₹5,000 for Class 9-10, ₹6,000 for Class 11-12',
    deadline: '2026-10-15',
    category: 'Minority Girls',
    url: 'https://bhmnsmaef.org/'
  },
  {
    id: '4',
    title: 'PM YASASVI Scheme',
    description: 'PM Young Achievers Scholarship Award Scheme for Vibrant India for OBCs and others to study in Top Class Schools targeted to reduce the financial burden of the families.',
    eligibility: 'Class 9-10 & 11-12. OBC, EBC, DNT categories. Family income < ₹2.5 Lakh.',
    amount: 'Up to ₹75,000(Class 9-10) and ₹1,25,000(Class 11-12)',
    deadline: '2026-12-31',
    category: 'OBC/EBC',
    url: 'https://yet.nta.ac.in/'
  },
  {
    id: '5',
    title: 'CBSE Single Girl Child Scholarship',
    description: 'Aimed to recognize the efforts of the parents in promoting education among girls and to provide encouragement to meritorious students.',
    eligibility: 'Single Girl Child who has passed Class 10 from CBSE with 60% and is continuing Class 11 & 12 in CBSE schools.',
    amount: '₹500 per month',
    deadline: '2026-09-30',
    category: 'Merit-Based',
    url: 'https://cbse.gov.in/'
  },
  {
    id: '6',
    title: 'Vidyadhan Scholarship',
    description: 'A scholarship program by Shibulal Family Philanthropic Initiatives for academically brilliant students from economically underprivileged families.',
    eligibility: 'Students who completed 10th grade. Minimum 90% or 9 CGPA. Family income < ₹2 Lakh.',
    amount: 'Up to ₹10,000 per annum',
    deadline: '2026-07-31',
    category: 'Private/NGO',
    url: 'https://www.vidyadhan.org/'
  }
];

router.get('/', requireAuth, requireRole('student'), (req, res) => {
  res.json({ scholarships: mockScholarships });
});

export default router;
