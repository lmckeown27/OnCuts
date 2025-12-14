/**
 * Admin Fraud Detection Page
 * 
 * Placeholder for future AI-powered fraud detection features
 */

import { Shield, AlertTriangle, TrendingUp, Users, Clock } from 'lucide-react';
import Card from '../../components/Card';
import AdminHeader from '../../components/AdminHeader';

export default function AdminFraudDetectionPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <AdminHeader title="Fraud Detection" />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Coming Soon Banner */}
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 mb-8">
          <div className="text-center py-12">
            <div className="bg-red-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">AI-Powered Fraud Detection</h2>
            <p className="text-xl text-gray-600 mb-4 max-w-2xl mx-auto">
              Coming Soon: Real-time fraud pattern recognition and automated alerts
            </p>
            <div className="inline-block bg-red-600 text-white px-6 py-2 rounded-full font-semibold">
              Feature In Development
            </div>
          </div>
        </Card>

        {/* Planned Features */}
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Planned Features</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <div className="flex items-start gap-4">
                <div className="bg-red-100 rounded-lg p-3">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">Pattern Recognition</h4>
                  <p className="text-sm text-gray-600">
                    AI analyzes booking patterns, cancellation rates, and payment anomalies to detect 
                    suspicious behavior across the platform.
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-4">
                <div className="bg-orange-100 rounded-lg p-3">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">Risk Scoring</h4>
                  <p className="text-sm text-gray-600">
                    Automated risk assessment for new users, unusual booking patterns, and 
                    payment method changes using machine learning models.
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-4">
                <div className="bg-yellow-100 rounded-lg p-3">
                  <Users className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">Multi-Account Detection</h4>
                  <p className="text-sm text-gray-600">
                    Identify users creating multiple accounts to abuse promotions or bypass 
                    restrictions using similarity analysis.
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 rounded-lg p-3">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">Real-Time Alerts</h4>
                  <p className="text-sm text-gray-600">
                    Instant notifications when high-risk activities are detected, with 
                    recommended actions and automated response options.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Integration Note */}
        <Card className="bg-primary-50 border-primary-200">
          <div className="flex items-start gap-4">
            <Shield className="w-6 h-6 text-primary-400 flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-bold text-gray-900 mb-2">AI Worker Integration</h4>
              <p className="text-sm text-gray-700 mb-3">
                This fraud detection system will be powered by the AI Worker microservice, which processes:
              </p>
              <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
                <li>Booking pattern analysis and anomaly detection</li>
                <li>Payment method verification and risk assessment</li>
                <li>User behavior correlation across accounts</li>
                <li>Automated risk scoring with explainable AI</li>
              </ul>
              <p className="text-sm text-gray-600 mt-3">
                Results will be stored in the <code className="bg-white px-2 py-1 rounded text-xs">fraud_flags</code> table 
                and accessible via the AI Worker's internal API.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

