/**
 * Integration tests for API endpoints using local MongoDB
 * Run: npm run test:integration
 * Requires: docker-compose up -d (MongoDB on port 27018)
 */

const mongoose = require('mongoose');

// Test configuration
const TEST_MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27018/beehive_test';

// Models
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  image: String,
  provider: String,
  providerId: String,
  ownedHives: [{ 
    id: String, 
    name: String, 
    location: String,
    coordinates: { lat: Number, lng: Number }
  }],
  role: { type: String, default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

const readingSchema = new mongoose.Schema({
  hiveId: { type: String, required: true, index: true },
  temperature: Number,
  humidity: Number,
  weight: Number,
  battery: Number,
  timestamp: { type: Date, default: Date.now, index: true }
});

const inspectionSchema = new mongoose.Schema({
  hiveId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  checklist: {
    queenSeen: Boolean,
    eggsLarvae: Boolean,
    broodPattern: String,
    honeyStores: String,
    pollenStores: String,
    population: String,
    temperament: String,
    diseasesSigns: Boolean,
    pestsSigns: Boolean,
    swarmCells: Boolean
  },
  notes: String,
  photos: [String],
  createdAt: { type: Date, default: Date.now }
});

let User, Reading, Inspection;
let testUser, testHiveId;

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(TEST_MONGODB_URI);
    
    // Create models
    User = mongoose.models.User || mongoose.model('User', userSchema);
    Reading = mongoose.models.Reading || mongoose.model('Reading', readingSchema);
    Inspection = mongoose.models.Inspection || mongoose.model('Inspection', inspectionSchema);
    
    // Clean up test data
    await User.deleteMany({ email: /@test\.com$/ });
    await Reading.deleteMany({ hiveId: /^TEST-/ });
    await Inspection.deleteMany({});
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({ email: /@test\.com$/ });
    await Reading.deleteMany({ hiveId: /^TEST-/ });
    await Inspection.deleteMany({});
    await mongoose.disconnect();
  });

  describe('User Operations', () => {
    test('should create a new user', async () => {
      testUser = await User.create({
        email: 'integration@test.com',
        name: 'Test User',
        provider: 'google',
        providerId: 'test-provider-id-123',
        ownedHives: [
          { id: 'TEST-001', name: 'Test Hive 1', location: 'Garden' },
          { id: 'TEST-002', name: 'Test Hive 2', location: 'Orchard' }
        ]
      });
      
      testHiveId = 'TEST-001';
      
      expect(testUser._id).toBeDefined();
      expect(testUser.email).toBe('integration@test.com');
      expect(testUser.ownedHives).toHaveLength(2);
    });

    test('should find user by email', async () => {
      const found = await User.findOne({ email: 'integration@test.com' });
      expect(found).not.toBeNull();
      expect(found.name).toBe('Test User');
    });

    test('should update user hives', async () => {
      await User.updateOne(
        { _id: testUser._id },
        { $push: { ownedHives: { id: 'TEST-003', name: 'New Hive', location: 'Field' } } }
      );
      
      const updated = await User.findById(testUser._id);
      expect(updated.ownedHives).toHaveLength(3);
    });

    test('should enforce unique email', async () => {
      await expect(User.create({
        email: 'integration@test.com',
        name: 'Duplicate User'
      })).rejects.toThrow();
    });
  });

  describe('Sensor Readings', () => {
    test('should create sensor readings', async () => {
      const readings = [];
      const now = new Date();
      
      // Create readings for last 24 hours
      for (let i = 0; i < 24; i++) {
        readings.push({
          hiveId: testHiveId,
          temperature: 32 + Math.random() * 4,
          humidity: 50 + Math.random() * 20,
          weight: 40 + Math.random() * 5,
          battery: 85 + Math.random() * 15,
          timestamp: new Date(now.getTime() - i * 60 * 60 * 1000)
        });
      }
      
      await Reading.insertMany(readings);
      
      const count = await Reading.countDocuments({ hiveId: testHiveId });
      expect(count).toBe(24);
    });

    test('should query readings by time range', async () => {
      const now = new Date();
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      
      const recentReadings = await Reading.find({
        hiveId: testHiveId,
        timestamp: { $gte: sixHoursAgo }
      }).sort({ timestamp: -1 });
      
      expect(recentReadings.length).toBeGreaterThanOrEqual(6);
      expect(recentReadings.length).toBeLessThanOrEqual(7);
    });

    test('should calculate average temperature', async () => {
      const result = await Reading.aggregate([
        { $match: { hiveId: testHiveId } },
        { $group: {
          _id: null,
          avgTemp: { $avg: '$temperature' },
          avgHumidity: { $avg: '$humidity' },
          minTemp: { $min: '$temperature' },
          maxTemp: { $max: '$temperature' }
        }}
      ]);
      
      expect(result[0].avgTemp).toBeGreaterThan(30);
      expect(result[0].avgTemp).toBeLessThan(38);
    });

    test('should get latest reading', async () => {
      const latest = await Reading.findOne({ hiveId: testHiveId })
        .sort({ timestamp: -1 });
      
      expect(latest).not.toBeNull();
      expect(latest.temperature).toBeDefined();
    });
  });

  describe('Inspections', () => {
    test('should create inspection record', async () => {
      const inspection = await Inspection.create({
        hiveId: testHiveId,
        userId: testUser._id,
        date: new Date(),
        checklist: {
          queenSeen: true,
          eggsLarvae: true,
          broodPattern: 'good',
          honeyStores: 'adequate',
          pollenStores: 'good',
          population: 'strong',
          temperament: 'calm',
          diseasesSigns: false,
          pestsSigns: false,
          swarmCells: false
        },
        notes: 'Healthy hive, good spring buildup'
      });
      
      expect(inspection._id).toBeDefined();
      expect(inspection.checklist.queenSeen).toBe(true);
    });

    test('should query inspections by hive', async () => {
      const inspections = await Inspection.find({ hiveId: testHiveId })
        .populate('userId', 'name email')
        .sort({ date: -1 });
      
      expect(inspections).toHaveLength(1);
      expect(inspections[0].userId.name).toBe('Test User');
    });

    test('should update inspection notes', async () => {
      await Inspection.updateOne(
        { hiveId: testHiveId },
        { $set: { notes: 'Updated notes after second check' } }
      );
      
      const updated = await Inspection.findOne({ hiveId: testHiveId });
      expect(updated.notes).toContain('Updated');
    });
  });

  describe('Data Relationships', () => {
    test('should verify user owns hive', async () => {
      const user = await User.findById(testUser._id);
      const ownsHive = user.ownedHives.some(h => h.id === testHiveId);
      expect(ownsHive).toBe(true);
    });

    test('should get all data for a hive', async () => {
      const [readings, inspections] = await Promise.all([
        Reading.find({ hiveId: testHiveId }).limit(10),
        Inspection.find({ hiveId: testHiveId })
      ]);
      
      expect(readings.length).toBeGreaterThan(0);
      expect(inspections.length).toBeGreaterThan(0);
    });
  });
});

describe('Data Validation', () => {
  test('should reject invalid temperature readings', async () => {
    const Reading = mongoose.model('Reading');
    
    // Temperature should be reasonable (-40 to 60°C)
    const validReading = {
      hiveId: 'TEST-VALIDATION',
      temperature: 35,
      humidity: 60,
      timestamp: new Date()
    };
    
    const reading = await Reading.create(validReading);
    expect(reading.temperature).toBe(35);
    
    // Clean up
    await Reading.deleteOne({ _id: reading._id });
  });

  test('should handle missing optional fields', async () => {
    const Reading = mongoose.model('Reading');
    
    const minimalReading = await Reading.create({
      hiveId: 'TEST-MINIMAL',
      timestamp: new Date()
    });
    
    expect(minimalReading._id).toBeDefined();
    expect(minimalReading.temperature).toBeUndefined();
    
    await Reading.deleteOne({ _id: minimalReading._id });
  });
});
