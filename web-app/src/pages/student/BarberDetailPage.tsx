import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, MapPin, Clock, DollarSign } from 'lucide-react';
import { Barber } from '../../types';
import barberService from '../../services/barber.service';
import Loading from '../../components/Loading';
import Button from '../../components/Button';
import Card from '../../components/Card';

export default function BarberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [barber, setBarber] = useState<Barber | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) loadBarber(id);
  }, [id]);

  const loadBarber = async (barberId: string) => {
    try {
      const data = await barberService.getBarberById(barberId);
      setBarber(data);
    } catch (error) {
      console.error('Failed to load barber:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <Loading fullScreen text="Loading barber..." />;
  if (!barber) return <div className="text-center py-12">Barber not found</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Portfolio Images */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {barber.portfolio_images?.map((image, index) => (
          <img
            key={image.id}
            src={image.image_url}
            alt={`Portfolio ${index + 1}`}
            className="w-full h-64 object-cover rounded-lg"
          />
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {barber.user?.first_name} {barber.user?.last_name}
          </h1>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1">
              <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
              <span className="font-semibold">{barber.average_rating.toFixed(1)}</span>
              <span className="text-gray-600">({barber.total_bookings} bookings)</span>
            </div>
            <div className="flex items-center gap-1 text-gray-600">
              <Clock className="w-5 h-5" />
              <span>{barber.years_of_experience} years exp.</span>
            </div>
          </div>

          <Card className="mb-6">
            <h2 className="font-semibold text-lg mb-2">About</h2>
            <p className="text-gray-700">{barber.bio}</p>
          </Card>

          <Card className="mb-6">
            <h2 className="font-semibold text-lg mb-3">Specialties</h2>
            <div className="flex flex-wrap gap-2">
              {barber.specialties.map((specialty, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                >
                  {specialty}
                </span>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-lg mb-3">Services & Pricing</h2>
            <div className="space-y-3">
              {barber.pricing?.map((service) => (
                <div key={service.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium">{service.name}</h3>
                    {service.description && (
                      <p className="text-sm text-gray-600">{service.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary-600">${service.price}</p>
                    <p className="text-sm text-gray-600">{service.duration_minutes} min</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div>
          <Card className="sticky top-20">
            <h2 className="font-semibold text-lg mb-4">Book an Appointment</h2>
            <Button
              fullWidth
              onClick={() => navigate(`/student/booking/${barber.id}`)}
            >
              Book Now
            </Button>
            {barber.instant_book_enabled && (
              <p className="text-sm text-green-600 mt-2 text-center">
                ⚡ Instant booking available
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

