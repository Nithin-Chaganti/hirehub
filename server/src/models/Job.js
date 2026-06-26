import mongoose from 'mongoose';

const { Schema } = mongoose;

const JOB_TYPES = ['full-time', 'part-time', 'internship', 'contract'];
const EXPERIENCE_LEVELS = ['fresher', 'mid', 'senior'];

const salarySchema = new Schema(
  {
    min: {
      type: Number,
      min: [0, 'Minimum salary cannot be negative'],
    },
    max: {
      type: Number,
      min: [0, 'Maximum salary cannot be negative'],
      validate: {
        validator(value) {
          return value == null || this.min == null || value >= this.min;
        },
        message: 'Maximum salary must be greater than or equal to minimum salary',
      },
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'INR',
    },
  },
  { _id: false }
);

const jobSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      minlength: [5, 'Job title must be at least 5 characters'],
      maxlength: [100, 'Job title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      trim: true,
      minlength: [20, 'Job description must be at least 20 characters'],
      maxlength: [5000, 'Job description cannot exceed 5000 characters'],
    },
    requirements: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      required: [true, 'At least one requirement is required'],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one requirement is required',
      },
    },
    salary: salarySchema,
    location: {
      type: String,
      required: [true, 'Job location is required'],
      trim: true,
    },
    jobType: {
      type: String,
      required: [true, 'Job type is required'],
      enum: {
        values: JOB_TYPES,
        message: 'Invalid job type',
      },
    },
    experienceLevel: {
      type: String,
      required: [true, 'Experience level is required'],
      enum: {
        values: EXPERIENCE_LEVELS,
        message: 'Invalid experience level',
      },
    },
    postedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recruiter is required'],
    },
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    views: {
      type: Number,
      default: 0,
      min: [0, 'Views cannot be negative'],
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    workMode: {
      type: String,
      required: [true, 'Work mode is required'],
      enum: {
        values: ['remote', 'hybrid', 'onsite'],
        message: 'Invalid work mode',
      }
    },
   
    applicationCount: {
      type: Number,
      default: 0,
      min: [0, 'Application count cannot be negative'],
    },
  },
  { timestamps: true }
);

jobSchema.index({ title: 'text', description: 'text' });
jobSchema.index({ location: 1, jobType: 1, experienceLevel: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ postedBy: 1 });
jobSchema.index({ company: 1 });

const Job = mongoose.model('Job', jobSchema);

export default Job;
