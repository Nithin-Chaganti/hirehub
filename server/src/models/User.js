import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { EXPERIENCE_LEVELS } from '../constants/jobConstants.js';
import {
  generateAccessToken,
  generateRefreshToken,
} from '../utils/tokenUtils.js';
import { applyExperienceFieldSync } from '../utils/talentUtils.js';

const { Schema } = mongoose;

const ROLES = ['candidate', 'recruiter', 'admin'];
const PHONE_REGEX = /^\d{10}$/;

const experienceSchema = new Schema(
  {
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true,
    },
    duration: {
      type: String,
      required: [true, 'Duration is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ROLES,
        message: 'Role must be either candidate, recruiter, or admin',
      },
      immutable: true,
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator(value) {
          return !value || PHONE_REGEX.test(value);
        },
        message: 'Phone must be a 10-digit number',
      },
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    location: {
      type: String,
      trim: true,
    },
    profilePicture: {
      url: {
        type: String,
        trim: true,
      },
      publicId: {
        type: String,
      },
    },
    resume: {
      url: {
        type: String,
        trim: true,
      },
      publicId: {
        type: String,
      },
    },
    skills: {
      type: [
        {
          type: String,
          trim: true,
          lowercase: true,
        },
      ],
      default: [],
    },
    experience: {
      type: [experienceSchema],
      default: [],
    },
    totalExperienceYears: {
      type: Number,
      default: 0,
      min: [0, 'Total experience years cannot be negative'],
    },
    experienceLevel: {
      type: String,
      enum: {
        values: EXPERIENCE_LEVELS,
        message: 'Invalid experience level',
      },
      default: 'fresher',
    },
    profileViews: {
      type: Number,
      default: 0,
      min: [0, 'Profile views cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpire: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.refreshToken;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpire;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.index({ skills: 1 });
userSchema.index({ role: 1, isActive: 1, experienceLevel: 1 });

userSchema.pre('save', async function prepareUser(next) {
  if (this.role === 'candidate' && (this.isModified('experience') || this.isNew)) {
    applyExperienceFieldSync(this);
  }

  if (!this.isModified('passwordHash')) {
    return next();
  }

  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  return next();
});

userSchema.methods.comparePassword = async function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

userSchema.methods.generateAccessToken = function createAccessToken() {
  return generateAccessToken(this._id, this.role);
};

userSchema.methods.generateRefreshToken = function createRefreshToken() {
  return generateRefreshToken(this._id);
};

const User = mongoose.model('User', userSchema);

export default User;
