import { useNavigate } from 'react-router-dom';
import { Users, ArrowLeft, Search, Star } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';

export default function ConsumerPage() {
  const navigate = useNavigate();

  const mockBarbers = [
    { id: 1, name: 'John Smith', rating: 4.8, bookings: 234, specialty: 'Fades & Tapers' },
    { id: 2, name: 'Mike Johnson', rating: 4.9, bookings: 189, specialty: 'Classic Cuts' },
    { id: 3, name: 'David Lee', rating: 4.7, bookings: 156, specialty: 'Beard Styling' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">Find a Barber</h1>
          </div>
          <Button onClick={() => navigate('/')} variant="secondary" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Roles
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search barbers, styles, specialties..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockBarbers.map((barber) => (
            <Card key={barber.id} hoverable>
              <div className="flex flex-col gap-3">
                <div className="w-full h-48 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center text-white text-4xl font-bold">
                  {barber.name.split(' ').map(n => n[0]).join('')}
                </div>
                <h3 className="text-xl font-bold text-gray-900">{barber.name}</h3>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="font-semibold text-gray-900">{barber.rating}</span>
                  <span className="text-sm text-gray-600">({barber.bookings} bookings)</span>
                </div>
                <p className="text-sm text-gray-600">{barber.specialty}</p>
                <Button className="w-full mt-2">Book Appointment</Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

