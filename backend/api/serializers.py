from rest_framework import serializers


class RouteRequestSerializer(serializers.Serializer):
    origin_lat = serializers.FloatField()
    origin_lon = serializers.FloatField()
    dest_lat = serializers.FloatField()
    dest_lon = serializers.FloatField()
    departure_time = serializers.DateTimeField()
    load_weight = serializers.FloatField(min_value=0)

    def validate_load_weight(self, val):
        if val > 80000:
            raise serializers.ValidationError("load looks too heavy for this demo")
        return val
